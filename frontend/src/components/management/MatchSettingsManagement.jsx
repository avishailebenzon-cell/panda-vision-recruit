import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot } from 'lucide-react';
import AgentThinkingLog from "./AgentThinkingLog";

export default function MatchSettingsManagement() {
    return (
        <div className="space-y-6 text-right" dir="rtl">
            {/* Real-time Agent Thinking Log */}
            <AgentThinkingLog />
            
            <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                    <strong>מערכת הסוכנים פועלת באופן אוטומטי</strong><br />
                    הסוכנים (נעמה, רועי, רמי, אליק, איתי, ליאור, אופיר, GC) מנוהלים על ידי כרמית ומופעלים אוטומטית דרך תזמונים בקוד.
                    <br />
                    <br />
                    ניתן לעקוב אחר פעילותם בזמן אמת דרך לוגים למעלה ובדפי הסוכנים עצמם.
                </AlertDescription>
            </Alert>
        </div>
    );
}