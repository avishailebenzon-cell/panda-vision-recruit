import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, FileText, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function ConversionLogManagement() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, inProgress: 0 });

    const loadLogs = async () => {
        setLoading(true);
        try {
            const allLogs = await base44.entities.ConversionLog.list('-created_date', 100);
            setLogs(allLogs);

            // Calculate stats
            const total = allLogs.length;
            const success = allLogs.filter(l => l.status === 'success').length;
            const failed = allLogs.filter(l => l.status === 'failed').length;
            const inProgress = allLogs.filter(l => l.status === 'in_progress').length;

            setStats({ total, success, failed, inProgress });
        } catch (error) {
            toast.error('שגיאה בטעינת לוגים: ' + error.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'success':
                return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 ml-1" />הצליח</Badge>;
            case 'failed':
                return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 ml-1" />נכשל</Badge>;
            case 'in_progress':
                return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 ml-1" />בתהליך</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatTime = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">המרות קבצים - ConvertAPI</h2>
                    <p className="text-sm text-gray-600">לוג כל ההמרות מ-Word ל-PDF</p>
                </div>
                <Button onClick={loadLogs} variant="outline" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
                    רענן
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                            <div className="text-sm text-gray-600 mt-1">סה"כ המרות</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{stats.success}</div>
                            <div className="text-sm text-gray-600 mt-1">הצליחו</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
                            <div className="text-sm text-gray-600 mt-1">נכשלו</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
                            <div className="text-sm text-gray-600 mt-1">בתהליך</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        היסטוריית המרות ({logs.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            אין נתוני המרות
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>תאריך</TableHead>
                                        <TableHead>קובץ</TableHead>
                                        <TableHead>המרה</TableHead>
                                        <TableHead>סטטוס</TableHead>
                                        <TableHead>זמן</TableHead>
                                        <TableHead>מועמד</TableHead>
                                        <TableHead>שגיאה</TableHead>
                                        <TableHead>קישור</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm">
                                                {new Date(log.created_date).toLocaleString('he-IL')}
                                            </TableCell>
                                            <TableCell className="font-medium max-w-xs truncate">
                                                {log.file_name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {log.source_format} → {log.target_format}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(log.status)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatTime(log.conversion_time_ms)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.candidate_name || '-'}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                {log.error_message ? (
                                                    <span className="text-xs text-red-600 line-clamp-2" title={log.error_message}>
                                                        {log.error_message}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {log.converted_url && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => window.open(log.converted_url, '_blank')}
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}