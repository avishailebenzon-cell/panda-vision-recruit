import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mail, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  XCircle,
  Heart
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Unsubscribe() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('initial'); // initial, success, error, not_found
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Get email from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleUnsubscribe = async () => {
    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('כתובת המייל לא תקינה');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('unsubscribeCandidate', { email });

      if (response.data.success) {
        setStatus('success');
      } else if (response.data.notFound) {
        setStatus('not_found');
      } else {
        setStatus('error');
        setErrorMessage(response.data.error || 'אירעה שגיאה בעת ביטול המנוי');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setStatus('error');
      setErrorMessage(error.message || 'אירעה שגיאה בעת ביטול המנוי');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6" dir="rtl">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-purple-600" />
          </div>
          <CardTitle className="text-2xl">
            {status === 'success' ? 'בוטלת בהצלחה' : 'ביטול מנוי למיילים'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'initial' && (
            <>
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  אנחנו מצטערים לראות אותך עוזב/ת! 
                  לחיצה על כפתור הביטול תסיר אותך מרשימת התפוצה של משרות פנדה-טק.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-2">כתובת המייל שלך:</p>
                <p className="text-base text-gray-900 font-mono" dir="ltr">
                  {email || 'לא זוהתה כתובת מייל'}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  לאחר ביטול המנוי:
                </p>
                <ul className="text-sm text-gray-600 space-y-2 mr-4">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>לא תקבל/י עוד מיילים על משרות חדשות מפנדה-טק</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>תוכל/י להירשם מחדש בעתיד בכל עת</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>פרטיך יישמרו במערכת למקרה של התאמה אישית</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleUnsubscribe}
                  disabled={loading || !email}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      מבטל מנוי...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 ml-2" />
                      בטל מנוי
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  רוצה להישאר איתנו? פשוט סגור את הדף הזה ותמשיך לקבל עדכונים על משרות מעניינות
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>המנוי בוטל בהצלחה</strong>
                  <br />
                  <br />
                  כתובת המייל {email} הוסרה מרשימת התפוצה שלנו.
                  <br />
                  לא תקבל/י עוד מיילים על משרות חדשות.
                </AlertDescription>
              </Alert>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-900 mb-2">
                  <Heart className="w-4 h-4 inline ml-1" />
                  שינית את דעתך?
                </p>
                <p className="text-xs text-purple-700">
                  תמיד תוכל/י ליצור איתנו קשר ב-jobs@pandatech.co.il 
                  ונשמח להוסיף אותך בחזרה לרשימת התפוצה.
                </p>
              </div>

              <div className="text-center pt-4">
                <a 
                  href="https://www.pandatech.co.il" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  🌐 בקר באתר פנדה-טק
                </a>
              </div>
            </div>
          )}

          {status === 'not_found' && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>כתובת המייל לא נמצאה במערכת</strong>
                <br />
                <br />
                ייתכן שכבר בוטל המנוי בעבר, או שהכתובת לא נמצאת ברשימת התפוצה שלנו.
                <br />
                <br />
                כתובת: {email}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <strong>אירעה שגיאה</strong>
                <br />
                <br />
                {errorMessage}
                <br />
                <br />
                אנא נסה שוב מאוחר יותר או צור קשר עם jobs@pandatech.co.il
              </AlertDescription>
            </Alert>
          )}

          {status !== 'initial' && status !== 'success' && (
            <div className="flex justify-center">
              <Button
                onClick={() => setStatus('initial')}
                variant="outline"
                className="gap-2"
              >
                חזור לדף הביטול
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}