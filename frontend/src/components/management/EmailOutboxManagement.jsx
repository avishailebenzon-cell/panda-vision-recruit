import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Mail, Search, RefreshCw, Loader2, CheckCircle, XCircle, Clock, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function EmailOutboxManagement() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const loadMessages = async () => {
        setLoading(true);
        try {
            // Load both EmailOutbox and EmailLog
            const [outboxData, logData] = await Promise.all([
                base44.entities.EmailOutbox.list('-created_date', 100),
                base44.entities.EmailLog.list('-created_date', 100)
            ]);
            
            // Merge and mark source
            const allMessages = [
                ...outboxData.map(m => ({ ...m, source_table: 'outbox' })),
                ...logData.map(m => ({ ...m, source_table: 'log' }))
            ];
            
            // Sort by created_date
            allMessages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            
            setMessages(allMessages);
        } catch (error) {
            console.error('Error loading email messages:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadMessages();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('he-IL');
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            sent: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'נשלח' },
            failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'נכשל' },
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'ממתין' }
        };
        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;

        return (
            <Badge className={config.color}>
                <Icon className="w-3 h-3 ml-1" />
                {config.label}
            </Badge>
        );
    };

    const filteredMessages = messages.filter(msg => {
        const matchesSearch = !searchTerm ||
            msg.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.from_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Mail className="w-6 h-6 text-blue-600" />
                        תיבת דואר יוצא (כל המיילים)
                    </div>
                    <Button onClick={loadMessages} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 ml-2" />
                        רענן
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="חיפוש לפי מס׳ הודעה, שם, נושא או תוכן..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="סטטוס" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">הכל</SelectItem>
                            <SelectItem value="sent">נשלח</SelectItem>
                            <SelectItem value="failed">נכשל</SelectItem>
                            <SelectItem value="pending">ממתין</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-700">{messages.length}</div>
                        <div className="text-sm text-blue-600">סה״כ הודעות</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-700">
                            {messages.filter(m => m.status === 'sent').length}
                        </div>
                        <div className="text-sm text-green-600">נשלחו</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-700">
                            {messages.filter(m => m.status === 'failed').length}
                        </div>
                        <div className="text-sm text-red-600">נכשלו</div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                                <TableHead>מס׳ הודעה</TableHead>
                                <TableHead>תאריך</TableHead>
                                <TableHead>נושא</TableHead>
                                <TableHead>נמען</TableHead>
                                <TableHead>סטטוס</TableHead>
                                <TableHead>מקור</TableHead>
                                <TableHead>שולח</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredMessages.length > 0 ? (
                                filteredMessages.map((msg) => (
                                    <TableRow key={msg.id}>
                                        <TableCell className="text-xs font-mono font-semibold text-blue-700">
                                            {msg.message_number || msg.resend_message_id?.substring(0, 8) || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {formatDate(msg.created_date)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={msg.subject}>
                                                {msg.subject || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="max-w-[180px] truncate" title={msg.to || msg.client_email}>
                                                {msg.to || msg.client_email || '-'}
                                            </div>
                                            {msg.candidate_name && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    מועמד: {msg.candidate_name}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(msg.status)}
                                            {msg.error_message && (
                                                <div className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={msg.error_message}>
                                                    {msg.error_message}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {msg.source_table === 'log' ? 'Resend' : 'Outlook'}
                                            </Badge>
                                            {msg.source && msg.source !== 'manual' && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {msg.source}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {msg.sent_by_user_name || msg.from_name || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center py-8 text-gray-500">
                                        לא נמצאו הודעות
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}