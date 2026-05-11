import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InternalCandidatesRecovery() {
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidates, setSelectedCandidates] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [recovering, setRecovering] = useState(false);

    useEffect(() => {
        loadInternalCandidates();
    }, []);

    const loadInternalCandidates = async () => {
        setLoading(true);
        try {
            // Get all EladTasks to find candidates sent internally
            const eladTasks = await base44.entities.EladTask.list('-created_date', 1000);
            
            // Get all matches to check current status
            const allMatches = await base44.entities.Match.list('-created_date', 2000);
            
            // Build a map of candidate_id -> their EladTasks
            const candidateTasksMap = new Map();
            for (const task of eladTasks) {
                if (!candidateTasksMap.has(task.candidate_id)) {
                    candidateTasksMap.set(task.candidate_id, []);
                }
                candidateTasksMap.get(task.candidate_id).push(task);
            }
            
            // Load full candidate data
            const candidatesList = [];
            for (const [candidateId, tasks] of candidateTasksMap.entries()) {
                try {
                    const candidateData = await base44.entities.Candidate.filter({ id: candidateId });
                    if (candidateData.length > 0) {
                        const candidate = candidateData[0];
                        
                        // Find matches for this candidate
                        const candidateMatches = allMatches.filter(m => m.candidate_id === candidateId);
                        
                        candidatesList.push({
                            ...candidate,
                            eladTasksCount: tasks.length,
                            latestEladTask: tasks[0],
                            matchesCount: candidateMatches.length,
                            latestMatch: candidateMatches.length > 0 ? candidateMatches[0] : null
                        });
                    }
                } catch (err) {
                    console.error(`Error loading candidate ${candidateId}:`, err);
                }
            }
            
            // Sort by latest EladTask date
            candidatesList.sort((a, b) => {
                const aDate = new Date(a.latestEladTask?.created_date || 0);
                const bDate = new Date(b.latestEladTask?.created_date || 0);
                return bDate - aDate;
            });
            
            setCandidates(candidatesList);
            
        } catch (error) {
            console.error('Error loading internal candidates:', error);
            toast.error('שגיאה בטעינת המועמדים');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleCandidate = (candidateId) => {
        const newSelected = new Set(selectedCandidates);
        if (newSelected.has(candidateId)) {
            newSelected.delete(candidateId);
        } else {
            newSelected.add(candidateId);
        }
        setSelectedCandidates(newSelected);
    };

    const handleRecoverSelected = async () => {
        if (selectedCandidates.size === 0) {
            toast.error('לא נבחרו מועמדים');
            return;
        }

        setRecovering(true);
        toast.loading(`משחזר ${selectedCandidates.size} מועמדים...`, { id: 'recovery' });

        try {
            let recovered = 0;
            
            for (const candidateId of selectedCandidates) {
                // Find all matches for this candidate that were sent to client
                const candidateMatches = await base44.entities.Match.filter({ 
                    candidate_id: candidateId 
                });
                
                // Mark matches as visible again by removing any blocking status
                for (const match of candidateMatches) {
                    // Update match to be visible again - we'll just update is_read to false
                    // This allows them to appear in searches again
                    await base44.entities.Match.update(match.id, {
                        is_read: false
                    });
                }
                
                recovered++;
            }
            
            toast.success(`${recovered} מועמדים שוחזרו בהצלחה`, { id: 'recovery' });
            
            // Reload data
            setSelectedCandidates(new Set());
            await loadInternalCandidates();
            
        } catch (error) {
            console.error('Error recovering candidates:', error);
            toast.error(`שגיאה בשחזור: ${error.message}`, { id: 'recovery' });
        } finally {
            setRecovering(false);
        }
    };

    const filteredCandidates = candidates.filter(c => 
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.latestEladTask?.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5" />
                        שחזור מועמדים שנשלחו פנימית
                    </CardTitle>
                    <CardDescription>
                        מועמדים שנשלחו פנימית למשרד (אלעד) והוסתרו מההתאמות
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            כפתור זה מאפשר לשחזר מועמדים שנשלחו פנימית למשרד ולהחזיר אותם להתאמות.
                            לאחר השחזור, המועמדים יופיעו שוב בחיפושים ובהתאמות של הסוכנים.
                        </AlertDescription>
                    </Alert>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="חיפוש לפי שם מועמד, משרה או אימייל..."
                                className="pr-10"
                            />
                        </div>
                        <Button
                            onClick={handleRecoverSelected}
                            disabled={selectedCandidates.size === 0 || recovering}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {recovering ? (
                                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> משחזר...</>
                            ) : (
                                <><RotateCcw className="w-4 h-4 ml-2" /> שחזר נבחרים ({selectedCandidates.size})</>
                            )}
                        </Button>
                        <Button
                            onClick={loadInternalCandidates}
                            disabled={loading}
                            variant="outline"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : filteredCandidates.length === 0 ? (
                        <div className="text-center p-12 text-gray-500">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                            <p>לא נמצאו מועמדים שנשלחו פנימית</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedCandidates(new Set(filteredCandidates.map(c => c.id)));
                                                    } else {
                                                        setSelectedCandidates(new Set());
                                                    }
                                                }}
                                            />
                                        </TableHead>
                                        <TableHead>שם מועמד</TableHead>
                                        <TableHead>משרה אחרונה</TableHead>
                                        <TableHead>סטטוס אלעד</TableHead>
                                        <TableHead>תאריך שליחה</TableHead>
                                        <TableHead>משימות</TableHead>
                                        <TableHead>התאמות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCandidates.map((candidate) => (
                                        <TableRow key={candidate.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedCandidates.has(candidate.id)}
                                                    onCheckedChange={() => handleToggleCandidate(candidate.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {candidate.full_name}
                                                {candidate.email && (
                                                    <div className="text-xs text-gray-500">{candidate.email}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {candidate.latestEladTask?.job_title || 'לא צוין'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {candidate.latestEladTask?.status || 'לא ידוע'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {candidate.latestEladTask?.sent_at 
                                                    ? new Date(candidate.latestEladTask.sent_at).toLocaleDateString('he-IL')
                                                    : candidate.latestEladTask?.created_date 
                                                    ? new Date(candidate.latestEladTask.created_date).toLocaleDateString('he-IL')
                                                    : '-'
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-blue-100 text-blue-800">
                                                    {candidate.eladTasksCount}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-purple-100 text-purple-800">
                                                    {candidate.matchesCount}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {!loading && filteredCandidates.length > 0 && (
                        <div className="text-sm text-gray-600 text-center">
                            מציג {filteredCandidates.length} מועמדים מתוך {candidates.length}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}