import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = await base44.auth.me();
    if (user.app_role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }

    try {
        console.log("Starting status deduplication process...");
        const allStatuses = await base44.asServiceRole.entities.CandidateStatus.list();
        allStatuses.sort((a, b) => a.created_date.localeCompare(b.created_date));

        const seenNumbers = new Set();
        const seenNames = new Set();
        const changes = [];
        
        let maxStatusNum = Math.max(...allStatuses.map(s => s.status_number), 0);

        for (const status of allStatuses) {
            let updatePayload = {};

            // Check for duplicate status_number
            if (seenNumbers.has(status.status_number)) {
                maxStatusNum++;
                updatePayload.status_number = maxStatusNum;
                changes.push(`Status ID ${status.id} ("${status.status_name}") number changed from ${status.status_number} to ${maxStatusNum}.`);
            } else {
                seenNumbers.add(status.status_number);
            }

            // Check for duplicate status_name
            if (seenNames.has(status.status_name.trim())) {
                const newName = `${status.status_name.trim()} (עותק)`;
                updatePayload.status_name = newName;
                changes.push(`Status ID ${status.id} name changed from "${status.status_name}" to "${newName}".`);
            } else {
                seenNames.add(status.status_name.trim());
            }

            if (Object.keys(updatePayload).length > 0) {
                await base44.asServiceRole.entities.CandidateStatus.update(status.id, updatePayload);
                // Also update the local object for next checks in this run
                if (updatePayload.status_number) {
                    seenNumbers.add(updatePayload.status_number);
                }
                 if (updatePayload.status_name) {
                    seenNames.add(updatePayload.status_name);
                }
            }
        }
        
        // Second pass to update next_possible_statuses
        const allStatusesAfterUpdate = await base44.asServiceRole.entities.CandidateStatus.list();
        const numberMapping = allStatuses.reduce((acc, oldStatus) => {
            const newStatus = allStatusesAfterUpdate.find(s => s.id === oldStatus.id);
            if (newStatus && oldStatus.status_number !== newStatus.status_number) {
                acc[oldStatus.status_number] = newStatus.status_number;
            }
            return acc;
        }, {});
        
        if (Object.keys(numberMapping).length > 0) {
             for (const status of allStatusesAfterUpdate) {
                if (status.next_possible_statuses && status.next_possible_statuses.length > 0) {
                   const updatedNextStatuses = status.next_possible_statuses
                        .map(num => numberMapping[num] || num) // Map old numbers to new numbers
                        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
                    
                   if (JSON.stringify(updatedNextStatuses) !== JSON.stringify(status.next_possible_statuses)) {
                       await base44.asServiceRole.entities.CandidateStatus.update(status.id, { next_possible_statuses: updatedNextStatuses });
                       changes.push(`Updated next_possible_statuses for status "${status.status_name}".`);
                   }
                }
            }
        }

        const message = changes.length > 0 ?
            `Deduplication complete. ${changes.length} changes made:\n- ${changes.join('\n- ')}` :
            'No duplicates found. Everything is in order.';
            
        console.log(message);
        return new Response(JSON.stringify({ success: true, message }), { status: 200 });

    } catch (error) {
        console.error("Error during status deduplication:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
});