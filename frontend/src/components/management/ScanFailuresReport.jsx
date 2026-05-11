import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ScanFailuresReport() {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, failed, permanently_failed

  useEffect(() => {
    loadFailures();
  }, []);

  const loadFailures = async () => {
    try {
      setLoading(true);
      const logs = await base44.asServiceRole.entities.ScannedFileLog.filter({
        processing_status: ['failed', 'permanently_failed']
      });
      setFailures(logs || []);
    } catch (error) {
      console.error('Failed to load failures:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFailures = filter === 'all' 
    ? failures
    : failures.filter(f => f.processing_status === filter);

  const failedCount = failures.filter(f => f.processing_status === 'failed').length;
  const permanentlyFailedCount = failures.filter(f => f.processing_status === 'permanently_failed').length;

  const getStatusIcon = (status) => {
    if (status === 'permanently_failed') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Clock className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusBadge = (status) => {
    if (status === 'permanently_failed') {
      return <Badge className="bg-red-100 text-red-800">נכשל סופית</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">כשל - ניתן לנסות מחדש</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          דוח קבצים שנכשלו בסריקה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <div className="text-sm text-gray-600">כשלים ניתנים לנסיון מחדש</div>
            <div className="text-2xl font-bold text-yellow-700">{failedCount}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-sm text-gray-600">כשלים סופיים</div>
            <div className="text-2xl font-bold text-red-700">{permanentlyFailedCount}</div>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">הכל ({failures.length})</TabsTrigger>
            <TabsTrigger value="failed">ניסיון מחדש ({failedCount})</TabsTrigger>
            <TabsTrigger value="permanently_failed">סופי ({permanentlyFailedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Refresh button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadFailures}
          disabled={loading}
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          רענן דוח
        </Button>

        {/* List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">טוען...</div>
        ) : filteredFailures.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <p className="text-gray-600">אין קבצים שנכשלו</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredFailures.map((failure) => (
              <div 
                key={failure.id}
                className="border rounded-lg p-3 space-y-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {getStatusIcon(failure.processing_status)}
                      {failure.file_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      מ: {failure.email_from || 'לא ידוע'}
                    </div>
                  </div>
                  {getStatusBadge(failure.processing_status)}
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  {failure.email_subject && (
                    <div>
                      <span className="font-medium">נושא מייל:</span> {failure.email_subject.substring(0, 60)}...
                    </div>
                  )}
                  <div>
                    <span className="font-medium">סטטוס:</span> {failure.processing_status === 'permanently_failed' ? 'נכשל לאחר 2 ניסיונות' : `ניסיון ${failure.retry_count || 0}/2`}
                  </div>
                  {failure.error_message && (
                    <div className="bg-red-50 p-2 rounded text-red-700">
                      <span className="font-medium">שגיאה:</span> {failure.error_message.substring(0, 100)}...
                    </div>
                  )}
                  <div className="text-gray-400">
                    {new Date(failure.created_date).toLocaleDateString('he-IL')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}