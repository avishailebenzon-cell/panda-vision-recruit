import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User, Mail, Phone, Calendar } from 'lucide-react';

export default function DuplicateCheckDialog({ 
  isOpen, 
  onClose, 
  duplicates, 
  candidateName,
  onProceed,
  onCancel
}) {
  if (!duplicates || duplicates.length === 0) return null;

  const getMatchScoreColor = (score) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            זוהו מועמדים דומים במערכת
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              נמצאו {duplicates.length} מועמדים דומים למועמד <strong>{candidateName}</strong> במערכת.
              אנא בדוק האם מדובר באותו אדם לפני המשך.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {duplicates.map((duplicate) => (
              <Card key={duplicate.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <User className="w-5 h-5 text-gray-500" />
                        <h3 className="text-lg font-semibold">
                          {duplicate.first_name} {duplicate.last_name}
                        </h3>
                        <Badge className={getMatchScoreColor(duplicate.matchScore)}>
                          התאמה: {duplicate.matchScore}%
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {duplicate.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{duplicate.email}</span>
                          </div>
                        )}
                        {duplicate.phone_primary && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{duplicate.phone_primary}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            נוצר: {new Date(duplicate.created_date).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <Badge variant="outline" className="text-xs">
                          סיבת התאמה: {duplicate.matchReason}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Alert>
            <AlertDescription>
              <strong>מה ברצונך לעשות?</strong>
              <br />
              • <strong>המשך בכל זאת</strong> - ייווצר מועמד חדש גם אם יש דומה לו במערכת
              <br />
              • <strong>ביטול</strong> - לא ייווצר מועמד חדש, תוכל לבדוק את המועמדים הקיימים
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            ביטול - לא ליצור מועמד
          </Button>
          <Button onClick={onProceed} className="bg-yellow-600 hover:bg-yellow-700">
            המשך בכל זאת - צור מועמד חדש
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}