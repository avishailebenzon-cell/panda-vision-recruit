
import React, { useState } from 'react';
import { User } from '@/entities/User';
import { SendEmail } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Send, Loader2, Mail } from 'lucide-react';

export default function ContactPage() {
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    });
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                setFormData(prev => ({
                    ...prev,
                    name: currentUser.full_name || '',
                    email: currentUser.email || ''
                }));
            } catch (error) {
                console.log("User not logged in");
            }
        };
        loadUser();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            setError('אנא מלא את כל שדות החובה (*)');
            return;
        }

        setSending(true);
        setError('');
        setSuccess(false);

        try {
            const emailSubject = `[PandaRecruitAI] פנייה חדשה: ${formData.subject}`;
            
            const emailBody = `
פנייה חדשה התקבלה דרך טופס יצירת הקשר במערכת PandaRecruitAI:

פרטי הפונה:
- שם: ${formData.name}
- אימייל: ${formData.email}
- טלפון: ${formData.phone || 'לא צוין'}

פרטי הפנייה:
- נושא: ${formData.subject}
- הודעה:
${formData.message}

תאריך: ${new Date().toLocaleString('he-IL')}
            `;

            await SendEmail({
                to: 'avishai@pandatech.co.il',
                subject: emailSubject,
                body: emailBody,
                from_name: `PandaRecruitAI Contact Form`
            });

            setSuccess(true);
            setFormData({
                name: user?.full_name || '',
                email: user?.email || '',
                phone: '',
                subject: '',
                message: ''
            });

        } catch (error) {
            console.error('Error sending contact form:', error);
            setError('שגיאה בשליחת הפנייה. אנא נסה שוב מאוחר יותר.');
        }

        setSending(false);
    };

    return (
        <div className="max-w-4xl lg:max-w-2xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
            <div className="text-center">
                <Mail className="mx-auto h-8 w-8 md:h-12 md:w-12 text-blue-600 mb-4" />
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">יצירת קשר</h1>
                <p className="text-sm md:text-base text-gray-600">נשמח לעמוד לרשותך בכל שאלה, בקשה או משוב</p>
            </div>

            {success && (
                <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        פנייתך נשלחה בהצלחה! ניצור עמך קשר בהקדם.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">טופס יצירת קשר</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div>
                                <Label htmlFor="name" className="text-sm md:text-base">שם מלא *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                    className="text-sm md:text-base mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="email" className="text-sm md:text-base">כתובת אימייל *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    required
                                    className="text-sm md:text-base mt-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="phone" className="text-sm md:text-base">טלפון (אופציונלי)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                className="text-sm md:text-base mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="subject" className="text-sm md:text-base">נושא הפנייה *</Label>
                            <Input
                                id="subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                required
                                className="text-sm md:text-base mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="message" className="text-sm md:text-base">הודעה *</Label>
                            <Textarea
                                id="message"
                                value={formData.message}
                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                                rows={4}
                                required
                                className="text-sm md:text-base mt-1"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={sending}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                    שולח...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 ml-2" />
                                    שלח פנייה
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
