import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Function to calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

Deno.serve(async (req) => {
    const MAX_EXECUTION_TIME_MS = 25000; // 25 seconds - very conservative
    const executionStartTime = Date.now();
    
    const checkTimeout = () => {
        if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
            throw new Error('TIMEOUT_APPROACHING');
        }
    };

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('=== CLEANING DUPLICATE CANDIDATES - OPTIMIZED ===');

        // Load candidates efficiently - EXCLUDING deleted ones
        const allCandidates = [];
        const batchSize = 100;
        const maxCandidates = 500; // Increased slightly
        let skip = 0;
        
        console.log('Loading candidates...');
        
        while (allCandidates.length < maxCandidates) {
            checkTimeout();
            
            const batch = await base44.asServiceRole.entities.Candidate.list('-created_date', batchSize, skip);
            
            if (batch.length === 0) break;
            
            // Filter out deleted candidates
            const activeBatch = batch.filter(c => 
                c.status !== 'לא רלוונטי יותר' && 
                !c.full_name?.toLowerCase().includes('מחוק') &&
                !c.full_name?.toLowerCase().includes('delete')
            );
            
            allCandidates.push(...activeBatch);
            skip += batchSize;
            
            if (batch.length < batchSize) break;
        }
        
        console.log(`✓ Loaded ${allCandidates.length} active candidates (filtered out deleted)`);

        // Step 1: Find exact name duplicates - IMPROVED WITH BETTER NORMALIZATION
        const exactNameGroups = new Map();
        let skippedNoName = 0;
        
        for (const candidate of allCandidates) {
            // Normalize name: remove extra spaces, convert to lowercase, handle Hebrew
            let fullNameKey = null;
            
            if (candidate.full_name && candidate.full_name.trim().length > 2) {
                fullNameKey = candidate.full_name.trim().replace(/\s+/g, ' ').toLowerCase();
            } else if (candidate.first_name && candidate.last_name) {
                const firstName = (candidate.first_name || '').trim();
                const lastName = (candidate.last_name || '').trim();
                if (firstName && lastName) {
                    fullNameKey = `${firstName} ${lastName}`.replace(/\s+/g, ' ').toLowerCase();
                }
            }
            
            if (fullNameKey && fullNameKey.length > 2) {
                if (!exactNameGroups.has(fullNameKey)) {
                    exactNameGroups.set(fullNameKey, []);
                }
                exactNameGroups.get(fullNameKey).push(candidate);
            } else {
                skippedNoName++;
            }
        }

        const exactNameDuplicates = Array.from(exactNameGroups.values()).filter(group => group.length > 1);
        console.log(`✓ Found ${exactNameDuplicates.length} exact name duplicate groups (skipped ${skippedNoName} without proper names)`);
        
        // Debug: Show first few name groups
        if (exactNameDuplicates.length > 0) {
            console.log('📝 Sample name duplicates:');
            exactNameDuplicates.slice(0, 3).forEach(group => {
                console.log(`  - ${group[0].full_name}: ${group.length} duplicates`);
            });
        }

        // Step 1b: Find exact email duplicates - IMPROVED
        const exactEmailGroups = new Map();
        let skippedNoEmail = 0;
        
        for (const candidate of allCandidates) {
            if (candidate.email && candidate.email.trim().length > 3) {
                // Normalize email: trim, lowercase, remove spaces
                const emailKey = candidate.email.trim().replace(/\s+/g, '').toLowerCase();
                
                // Skip invalid emails
                if (emailKey.includes('@') && emailKey.length > 5) {
                    if (!exactEmailGroups.has(emailKey)) {
                        exactEmailGroups.set(emailKey, []);
                    }
                    exactEmailGroups.get(emailKey).push(candidate);
                } else {
                    skippedNoEmail++;
                }
            } else {
                skippedNoEmail++;
            }
        }

        const exactEmailDuplicates = Array.from(exactEmailGroups.values()).filter(group => group.length > 1);
        console.log(`✓ Found ${exactEmailDuplicates.length} exact email duplicate groups (skipped ${skippedNoEmail} without valid emails)`);
        
        // Debug: Show first few email groups
        if (exactEmailDuplicates.length > 0) {
            console.log('📧 Sample email duplicates:');
            exactEmailDuplicates.slice(0, 3).forEach(group => {
                console.log(`  - ${group[0].email}: ${group.length} duplicates`);
            });
        }

        // Combine both duplicate types, avoiding duplicates in the merge list
        const processedIds = new Set();
        const exactDuplicates = [];
        
        for (const group of exactNameDuplicates) {
            const groupKey = group.map(c => c.id).sort().join('-');
            if (!processedIds.has(groupKey)) {
                exactDuplicates.push({ group, reason: 'שם זהה' });
                processedIds.add(groupKey);
            }
        }
        
        for (const group of exactEmailDuplicates) {
            // Check if this group overlaps with already added groups
            const ids = group.map(c => c.id);
            const alreadyProcessed = ids.some(id => 
                Array.from(processedIds).some(key => key.includes(id))
            );
            if (!alreadyProcessed) {
                exactDuplicates.push({ group, reason: 'אימייל זהה' });
                processedIds.add(ids.sort().join('-'));
            }
        }
        
        console.log(`✓ Total duplicate groups to process: ${exactDuplicates.length}`);
        
        // Log all duplicates found for debugging
        if (exactDuplicates.length > 0) {
            console.log('🔍 All duplicates found:');
            exactDuplicates.forEach((d, idx) => {
                console.log(`  ${idx + 1}. ${d.reason}:`, d.group.map(c => 
                    `${c.full_name || `${c.first_name} ${c.last_name}`} (${c.email || 'no email'})`
                ).join(' | '));
            });
        }

        // Step 2: Check for similar names, same email, same phone (manual review) - SKIPPED FOR SPEED
        // This is too slow and causes timeouts - will be handled in a separate function if needed
        const pendingReviewGroups = [];
        console.log('Skipping similarity check to avoid timeout');

        // Step 3: Save duplicates to PendingDuplicateMerge for manual approval
        // Process only 5 groups per run to avoid timeout and allow continuous runs
        const groupsToProcess = exactDuplicates.slice(0, 5);
        let pendingSaved = 0;
        let skippedExisting = 0;

        console.log(`📝 Saving ${groupsToProcess.length} duplicate groups for manual review (${exactDuplicates.length} total found)...`);

        // FIX: Load all existing pending entries ONCE to avoid duplicate records in the table
        const allExistingPending = await base44.asServiceRole.entities.PendingDuplicateMerge.list();
        const existingPendingIds = new Set(
            (allExistingPending || [])
                .filter(p => p.data?.status === 'pending')
                .flatMap(p => p.data?.candidate_ids || [])
        );

        for (const { group, reason } of groupsToProcess) {
            checkTimeout();

            // Sort by creation date (oldest first)
            group.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

            const candidateIds = group.map(c => c.id);
            const candidateNames = group.map(c =>
                c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()
            );

            // FIX: Skip if any candidate in this group already has a pending merge entry
            const alreadyExists = candidateIds.some(id => existingPendingIds.has(id));
            if (alreadyExists) {
                skippedExisting++;
                console.log(`⏭ Skipping already-pending group: ${candidateNames.join(' & ')}`);
                continue;
            }

            // Determine duplicate type
            let duplicateType = 'exact_name';
            if (reason.includes('אימייל')) duplicateType = 'same_email';

            // Create pending duplicate merge request
            await base44.asServiceRole.entities.PendingDuplicateMerge.create({
                data: {
                    candidate_ids: candidateIds,
                    candidate_names: candidateNames,
                    duplicate_type: duplicateType,
                    match_reason: reason,
                    status: 'pending'
                }
            });

            // Add to existing set so we don't add duplicates within same run
            candidateIds.forEach(id => existingPendingIds.add(id));
            pendingSaved++;
            console.log(`✓ Saved pending merge: ${candidateNames.join(' & ')}`);
        }

        // No auto-merging - all sent for approval
        const mergedCount = 0;
        const deletedCount = 0;
        const mergeDetails = [];

        console.log('=== CLEANUP COMPLETED ===');

        const remainingGroups = Math.max(0, exactDuplicates.length - groupsToProcess.length);

        return Response.json({
            success: true,
            message: remainingGroups > 0
                ? `נשלחו ${pendingSaved} כפילויות חדשות לאישור (${skippedExisting} כבר קיימות). נותרו עוד ${remainingGroups} - ממשיך...`
                : `מצאנו ${exactDuplicates.length} כפילויות. ${pendingSaved} נשלחו לאישור ידני (${skippedExisting} כבר קיימות בתור).`,
            summary: {
                totalCandidatesScanned: allCandidates.length,
                duplicateGroupsFound: exactDuplicates.length,
                nameGroups: exactNameDuplicates.length,
                emailGroups: exactEmailDuplicates.length,
                duplicateGroupsProcessed: groupsToProcess.length,
                newPendingCreated: pendingSaved,
                skippedAlreadyPending: skippedExisting,
                candidatesMerged: 0,
                candidatesDeleted: 0,
                pendingReviewGroups: pendingSaved,
                remainingGroups: remainingGroups
            },
            details: []
        });

    } catch (error) {
        console.error('Error cleaning duplicates:', error);
        
        if (error.message === 'TIMEOUT_APPROACHING') {
            return Response.json({ 
                success: true,
                message: 'הפעולה הגיעה למגבלת זמן - הרץ שוב להמשך',
                partialCompletion: true
            });
        }
        
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});