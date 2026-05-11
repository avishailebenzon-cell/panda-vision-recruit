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
import { Smartphone, Search, RefreshCw, Loader2, CheckCircle, XCircle, Clock, TestTube } from 'lucide-react';
import { WhatsappOutbox } from '@/entities/WhatsappOutbox';

export default function WhatsAppOutboxTable() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const loadMessages = async () => {
        setLoading(true);
        try {
            const data = await WhatsappOutbox.list('-created_date', 100);
            setMessages(data);
        } catch (error) {
            console.error('Error loading WhatsApp messages:', error);
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

    const getStatusBadge = (status, isTestMode) => {
        const statusConfig = {
            sent: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'נשלח' },
            failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'נכשל' },
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'ממתין' }
        };
        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;

        return (
            <div className="flex items-center gap-1">
                <Badge className={config.color}>
                    <Icon className="w-3 h-3 ml-1" />
                    {config.label}
                </Badge>
                {isTestMode && (
                    <Badge className="bg-purple-100 text-purple-800">
                        <TestTube className="w-3 h-3 ml-1" />
                        בדיקה
                    </Badge>
                )}
            </div>
        );
    };

    const filteredMessages = messages.filter(msg => {
        const matchesSearch = !searchTerm ||
            msg.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message_content?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-6 h-6 text-green-600" />
                        תיבת דואר יוצא (WhatsApp)
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
                                placeholder="חיפוש לפי שם, לקוח או תוכן..."
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
                <div className="grid grid-cols-4 gap-4 mb-4">
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
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-700">
                            {messages.filter(m => m.is_test_mode).length}
                        </div>
                        <div className="text-sm text-purple-600">במצב בדיקה</div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                                <TableHead>מס׳ הודעה</TableHead>
                                <TableHead>תאריך</TableHead>
                                <TableHead>נמען</TableHead>
                                <TableHead>טלפון</TableHead>
                                <TableHead>מועמד</TableHead>
                                <TableHead>לקוח</TableHead>
                                <TableHead>סטטוס</TableHead>
                                <TableHead>שולח</TableHead>
                                <TableHead>תוכן</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="9" className="text-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredMessages.length > 0 ? (
                                filteredMessages.map((msg) => (
                                    <TableRow key={msg.id}>
                                        <TableCell className="text-xs font-mono font-semibold text-blue-700">
                                            {msg.message_number || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {formatDate(msg.created_date)}
                                        </TableCell>
                                        <TableCell>{msg.recipient_name || '-'}</TableCell>
                                        <TableCell className="text-xs">
                                            {msg.recipient_phone || msg.client_phone || '-'}
                                        </TableCell>
                                        <TableCell>{msg.candidate_name || '-'}</TableCell>
                                        <TableCell>{msg.client_name || '-'}</TableCell>
                                        <TableCell>
                                            {getStatusBadge(msg.status, msg.is_test_mode)}
                                            {msg.error_message && (
                                                <div className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={msg.error_message}>
                                                    {msg.error_message}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">{msg.sent_by_user_name || '-'}</TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate text-xs" title={msg.message_content}>
                                                {msg.message_content?.substring(0, 50)}...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan="9" className="text-center py-8 text-gray-500">
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