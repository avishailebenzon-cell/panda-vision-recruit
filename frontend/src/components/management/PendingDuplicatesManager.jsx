import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Users, Mail, Phone, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function PendingDuplicatesManager() {
  const [pendingDuplicates, setPendingDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadPendingDuplicates();
  }, []);

  const loadPendingDuplicates = async () => {
    try {
      setLoading(true);
      const allPending = await base44.entities.PendingDuplicateMerge.list();
      // Filter by status inside data object
      const pending = (allPending || []).filter(p => p.data?.status === 'pending');
      setPendingDuplicates(pending);
    } catch (error) {
      console.error('Error loading pending duplicates:', error);
      toast.error('שגיאה בטעינת כפילויות');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (pendingId, action) => {
    try {
      setProcessing(pendingId);
      
      const response = await base44.functions.invoke('mergePendingDuplicates', {
        pendingId,
        action
      });

      if (response.success) {
        toast.success(action === 'approve' ? 'המועמדים מוזגו בהצלחה' : 'הכפילות נדחתה');
        await loadPendingDuplicates();
      }
    } catch (error) {
      console.error('Error processing duplicate:', error);
      toast.error('שגיאה בעיבוד הכפילות');
    } finally {
      setProcessing(null);
    }
  };

  const getDuplicateTypeIcon = (type) => {
    switch (type) {
      case 'similar_name': return <Users className="w-4 h-4" />;
      case 'same_email': return <Mail className="w-4 h-4" />;
      case 'same_phone': return <Phone className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getDuplicateTypeBadge = (type) => {
    const types = {
      similar_name: { label: 'שם דומה', color: 'bg-blue-100 text-blue-800' },
      same_email: { label: 'אימייל זהה', color: 'bg-purple-100 text-purple-800' },
      same_phone: { label: 'טלפון זהה', color: 'bg-green-100 text-green-800' },
      exact_name: { label: 'שם זהה', color: 'bg-red-100 text-red-800' }
    };
    
    const config = types[type] || { label: type, color: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={config.color}>
        {getDuplicateTypeIcon(type)}
        <span className="mr-1">{config.label}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (pendingDuplicates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            כפילויות ממתינות לאישור
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              אין כפילויות ממתינות לאישור כרגע. הרץ את תהליך ניקוי הכפילויות כדי לזהות כפילויות חדשות.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          כפילויות ממתינות לאישור ({pendingDuplicates.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingDuplicates.map((pending) => {
          if (!pending || !pending.data) return null;
          
          const duplicateType = pending.data?.duplicate_type || pending.duplicate_type;
          const matchReason = pending.data?.match_reason || pending.match_reason;
          const candidateNames = pending.data?.candidate_names || [];
          
          return (
            <Card key={pending.id} className="border-2">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      {getDuplicateTypeBadge(duplicateType)}
                      {matchReason && <p className="text-sm text-gray-600">{matchReason}</p>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(pending.created_date).toLocaleDateString('he-IL')}
                    </div>
                  </div>

                  {candidateNames.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded space-y-1">
                      <p className="text-sm font-medium">מועמדים:</p>
                      {candidateNames.map((name, idx) => (
                        <div key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          {name}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(pending.id, 'reject')}
                      disabled={processing === pending.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      {processing === pending.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 ml-2" />
                          אלו לא כפילויות
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction(pending.id, 'approve')}
                      disabled={processing === pending.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === pending.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 ml-2" />
                          מזג מועמדים
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}