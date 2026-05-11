import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { UploadFile } from "@/integrations/Core";

export default function CandidateOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // פרטים אישיים
    email: "",
    first_name: "",
    last_name: "",
    first_name_english: "",
    last_name_english: "",
    date_of_birth: "",
    immigration_date: "",
    immigration_country: "",
    id_number: "",
    gender: "",
    phone_secondary: "",
    phone_primary: "",
    city: "",
    address: "",
    postal_code: "",
    languages: "",
    has_drivers_license: "",
    
    // איך הגעת
    how_found_pandatech: [],
    how_found_pandatech_other: "",
    referred_by_employee_name: "",
    
    // מועמדות
    marital_status: "",
    applied_to_companies_last_year: [],
    applied_via_other_company: [],
    applying_to_company: "",
    applying_to_position: "",
    references: "",
    consent_recruitment_process: false,
    consent_no_parallel_application: false,
    
    // תנאי העסקה
    desired_field: "",
    main_role_experience: "",
    work_percentage: 100,
    salary_expectation: "",
    needs_leasing_car: "",
    hobbies: "",
    needs_lunch_at_client: "",
    expected_start_date: "",
    
    // סווג בטחוני
    security_clearance: "לא יודע/ת",
    security_clearance_authority: "",
    security_clearance_year: "",
    has_other_citizenship: false,
    other_citizenship_country: "",
    security_officer_name: "",
    security_officer_phone: "",
    
    // השכלה
    education_1: "",
    education_2: "",
    education_3: "",
    
    // מקומות עבודה
    job_1_company: "",
    job_1_end_date: "",
    job_1_end_reason: "",
    job_2_company: "",
    job_2_end_date: "",
    job_2_end_reason: "",
    
    // שירות צבאי
    military_rank: "",
    military_recruitment_year: "",
    military_discharge_year: "",
    military_service: "",
    
    // הערות
    additional_notes: ""
  });
  
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field, value) => {
    setFormData(prev => {
      const current = prev[field] || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleFileUpload = async (field, file) => {
    setUploadingFiles(prev => ({ ...prev, [field]: true }));
    try {
      const { file_url } = await UploadFile({ file });
      updateField(field, file_url);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("שגיאה בהעלאת הקובץ");
    }
    setUploadingFiles(prev => ({ ...prev, [field]: false }));
  };

  const handleMultiFileUpload = async (field, files) => {
    setUploadingFiles(prev => ({ ...prev, [field]: true }));
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        urls.push(file_url);
      }
      updateField(field, urls);
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("שגיאה בהעלאת הקבצים");
    }
    setUploadingFiles(prev => ({ ...prev, [field]: false }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.email || !formData.first_name || !formData.last_name || 
        !formData.id_number || !formData.phone_primary) {
      alert("נא למלא את כל השדות החובה");
      return;
    }

    if (!formData.consent_recruitment_process || !formData.consent_no_parallel_application) {
      alert("נא לאשר את ההסכמות הנדרשות");
      return;
    }

    if (!formData.id_photo_url) {
      alert("נא להעלות צילום ת.ז וספח");
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);

    try {
      // Check if candidate exists by email or ID number
      const existingByEmail = await base44.entities.Candidate.filter({ email: formData.email });
      const existingById = await base44.entities.Candidate.filter({ id_number: formData.id_number });
      
      const existing = existingByEmail[0] || existingById[0];

      const candidateData = {
        ...formData,
        full_name: `${formData.first_name} ${formData.last_name}`,
        onboarding_form_completed: true,
        onboarding_form_date: new Date().toISOString(),
        status: "מועמד",
        status_number: 10
      };

      if (existing) {
        // Update existing candidate
        await base44.entities.Candidate.update(existing.id, candidateData);
        setSubmitStatus({ type: "success", message: "הנתונים שלך עודכנו בהצלחה!" });
      } else {
        // Create new candidate
        await base44.entities.Candidate.create(candidateData);
        setSubmitStatus({ type: "success", message: "הנתונים שלך נשמרו בהצלחה! נהיה איתך בקשר בהמשך." });
      }

    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitStatus({ type: "error", message: "אירעה שגיאה בשמירת הנתונים. נסה שוב." });
    }

    setSubmitting(false);
  };

  const validateStep = (stepNumber) => {
    const missingFields = [];
    
    switch(stepNumber) {
      case 1:
        if (!formData.email) missingFields.push('אימייל');
        if (!formData.first_name) missingFields.push('שם פרטי');
        if (!formData.last_name) missingFields.push('שם משפחה');
        if (!formData.first_name_english) missingFields.push('שם פרטי באנגלית');
        if (!formData.last_name_english) missingFields.push('שם משפחה באנגלית');
        if (!formData.date_of_birth) missingFields.push('תאריך לידה');
        if (!formData.gender) missingFields.push('מין');
        if (!formData.id_number) missingFields.push('מספר ת.ז');
        break;
      case 2:
        if (!formData.phone_primary) missingFields.push('טלפון נייד');
        if (!formData.city) missingFields.push('עיר מגורים');
        if (!formData.address) missingFields.push('כתובת');
        if (!formData.languages) missingFields.push('ידע בשפות');
        if (!formData.marital_status) missingFields.push('סטטוס משפחתי');
        break;
      case 3:
        if (!formData.how_found_pandatech || formData.how_found_pandatech.length === 0) {
          missingFields.push('איך הגעת לפנדה-טק');
        }
        if (!formData.applied_to_companies_last_year || formData.applied_to_companies_last_year.length === 0) {
          missingFields.push('האם הגשת מועמדות לחברות אחרות בשנה האחרונה');
        }
        if (!formData.applied_via_other_company || formData.applied_via_other_company.length === 0) {
          missingFields.push('האם הגשת מועמדות דרך חברה אחרת');
        }
        if (!formData.applying_to_company) missingFields.push('החברה אליה אתה מגיש מועמדות');
        if (!formData.applying_to_position) missingFields.push('התפקיד אליו אתה מתמיין');
        if (!formData.consent_recruitment_process) missingFields.push('הסכמה לתהליך גיוס');
        if (!formData.consent_no_parallel_application) missingFields.push('התחייבות לאי הגשת מועמדות מקבילה');
        break;
      case 4:
        if (!formData.work_percentage) missingFields.push('אחוזי משרה');
        if (!formData.salary_expectation) missingFields.push('ציפיות שכר');
        if (!formData.needs_leasing_car) missingFields.push('צורך ברכב ליסינג');
        if (!formData.needs_lunch_at_client) missingFields.push('צורך בארוחות באתר');
        if (!formData.expected_start_date) missingFields.push('מועד תחילת עבודה');
        break;
      case 5:
        if (!formData.security_clearance) missingFields.push('סווג בטחוני');
        if (!formData.id_photo_url) missingFields.push('צילום ת.ז וספח');
        if (formData.has_other_citizenship === null || formData.has_other_citizenship === undefined || formData.has_other_citizenship === '') {
          missingFields.push('האם יש אזרחות נוספת');
        }
        break;
      case 7:
        if (!formData.additional_notes) missingFields.push('הערות נוספות');
        break;
    }
    
    return missingFields;
  };

  const handleNext = () => {
    const missingFields = validateStep(currentStep);
    
    if (missingFields.length > 0) {
      setValidationError({
        title: 'יש למלא את שדות החובה הבאים:',
        fields: missingFields
      });
      return;
    }
    
    setValidationError(null);
    setCurrentStep(currentStep + 1);
  };

  const steps = [
    { number: 1, title: "פרטים אישיים", fields: ["email", "first_name", "last_name"] },
    { number: 2, title: "פרטי קשר ומגורים", fields: ["phone_primary", "city", "address"] },
    { number: 3, title: "הגשת מועמדות", fields: ["applying_to_company", "applying_to_position"] },
    { number: 4, title: "תנאי העסקה", fields: ["work_percentage", "salary_expectation"] },
    { number: 5, title: "סווג בטחוני", fields: ["security_clearance", "id_photo_url"] },
    { number: 6, title: "השכלה ומקומות עבודה", fields: [] },
    { number: 7, title: "שירות צבאי וסיכום", fields: [] }
  ];

  if (submitStatus?.type === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">תודה רבה!</h2>
            <p className="text-gray-600 mb-6">{submitStatus.message}</p>
            <p className="text-sm text-gray-500">נשמח להיות איתך בקשר בהמשך</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">P</span>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-gray-900">Pandatech</h1>
              <p className="text-gray-600">שאלון פרטים אישיים למועמד</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">הטופס בנוי ממספר שלבים ומטרתו לעזור לנו להכיר אותך טוב יותר</p>
            <p>זמן מילוי: עד 15 דקות | הכן מראש: צילומי ת.ז, תמונת פרופיל, תעודות השכלה וקורות חיים</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, idx) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentStep === step.number 
                      ? 'bg-blue-600 text-white' 
                      : currentStep > step.number 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step.number ? <CheckCircle className="w-5 h-5" /> : step.number}
                  </div>
                  <span className="text-xs mt-1 text-gray-600 hidden md:block text-center">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>אנא מלא את הפרטים הבאים</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* שלב 1: פרטים אישיים */}
            {currentStep === 1 && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>אימייל *</Label>
                    <Input value={formData.email} onChange={(e) => updateField('email', e.target.value)} type="email" required />
                  </div>
                  <div>
                    <Label>מספר ת.ז *</Label>
                    <Input value={formData.id_number} onChange={(e) => updateField('id_number', e.target.value)} required />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>שם פרטי *</Label>
                    <Input value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} required />
                  </div>
                  <div>
                    <Label>שם משפחה *</Label>
                    <Input value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} required />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>שם פרטי באנגלית *</Label>
                    <Input value={formData.first_name_english} onChange={(e) => updateField('first_name_english', e.target.value)} required />
                  </div>
                  <div>
                    <Label>שם משפחה באנגלית *</Label>
                    <Input value={formData.last_name_english} onChange={(e) => updateField('last_name_english', e.target.value)} required />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>תאריך לידה *</Label>
                    <Input value={formData.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} type="date" required />
                  </div>
                  <div>
                    <Label>מין *</Label>
                    <Select value={formData.gender} onValueChange={(val) => updateField('gender', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="זכר">זכר</SelectItem>
                        <SelectItem value="נקבה">נקבה</SelectItem>
                        <SelectItem value="מעדיף לא לומר">מעדיף לא לומר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>תאריך עלייה</Label>
                    <Input value={formData.immigration_date} onChange={(e) => updateField('immigration_date', e.target.value)} type="date" />
                  </div>
                  <div>
                    <Label>ארץ עלייה</Label>
                    <Input value={formData.immigration_country} onChange={(e) => updateField('immigration_country', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* שלב 2: פרטי קשר */}
            {currentStep === 2 && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>טלפון נייד *</Label>
                    <Input value={formData.phone_primary} onChange={(e) => updateField('phone_primary', e.target.value)} type="tel" required />
                  </div>
                  <div>
                    <Label>טלפון בבית</Label>
                    <Input value={formData.phone_secondary} onChange={(e) => updateField('phone_secondary', e.target.value)} type="tel" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>עיר מגורים *</Label>
                    <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} required />
                  </div>
                  <div>
                    <Label>מיקוד</Label>
                    <Input value={formData.postal_code} onChange={(e) => updateField('postal_code', e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>כתובת (רחוב ומספר) *</Label>
                  <Input value={formData.address} onChange={(e) => updateField('address', e.target.value)} required />
                </div>

                <div>
                  <Label>ידע בשפות (פרט/י שפות) *</Label>
                  <Textarea value={formData.languages} onChange={(e) => updateField('languages', e.target.value)} rows={2} required />
                </div>

                <div>
                  <Label>בעל/ת רישיון נהיגה</Label>
                  <Select value={formData.has_drivers_license} onValueChange={(val) => updateField('has_drivers_license', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="כן">כן</SelectItem>
                      <SelectItem value="לא">לא</SelectItem>
                      <SelectItem value="אחר">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>סטטוס משפחתי *</Label>
                  <Select value={formData.marital_status} onValueChange={(val) => updateField('marital_status', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="רווק/ה">רווק/ה</SelectItem>
                      <SelectItem value="נשוי/ה">נשוי/ה</SelectItem>
                      <SelectItem value="נשוי/ה עם ילדים">נשוי/ה עם ילדים</SelectItem>
                      <SelectItem value="גרוש/ה">גרוש/ה</SelectItem>
                      <SelectItem value="אחר">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Validation Error Alert */}
            {validationError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">{validationError.title}</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {validationError.fields.map((field, idx) => (
                      <li key={idx}>{field}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* שלב 3: הגשת מועמדות */}
            {currentStep === 3 && (
              <>
                <div>
                  <Label>איך הגעת לפנדה-טק? *</Label>
                  <div className="space-y-2 mt-2">
                    {['LinkedIn - לינקאין', 'Facebook - פייסבוק', 'פרסום דרושים של פנדה-טק', 'מייל שקיבלת מאיתנו לגבי משרות', 'אתר החברה', 'חבר מביא חבר'].map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.how_found_pandatech.includes(option)}
                          onCheckedChange={() => toggleArrayField('how_found_pandatech', option)}
                        />
                        <Label className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                    <Input 
                      placeholder="אחר..." 
                      value={formData.how_found_pandatech_other} 
                      onChange={(e) => updateField('how_found_pandatech_other', e.target.value)} 
                    />
                  </div>
                </div>

                {formData.how_found_pandatech.includes('חבר מביא חבר') && (
                  <div>
                    <Label>מיהו העובד שחיבר אותך אלינו?</Label>
                    <Input value={formData.referred_by_employee_name} onChange={(e) => updateField('referred_by_employee_name', e.target.value)} />
                  </div>
                )}

                <div>
                  <Label>במהלך השנה האחרונה, האם הגשת מועמדות לאחת מהחברות הבאות? *</Label>
                  <div className="space-y-2 mt-2">
                    {['תעשייה אווירית', 'רפאל', 'אלביט', 'משרד רוה"מ', 'חברת החשמל לישראל', 'חשכ״ל', 'מכרז ממשלתי כלשהו', 'לא ניגשתי לאף אחת מהחברות הנ"ל'].map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.applied_to_companies_last_year.includes(option)}
                          onCheckedChange={() => toggleArrayField('applied_to_companies_last_year', option)}
                        />
                        <Label className="cursor-pointer text-sm">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>במהלך השנה האחרונה, האם הגשת מועמדות דרך חברה אחרת? *</Label>
                  <div className="space-y-2 mt-2">
                    {['החברה אליה הינך מועמד מטעם פנדה-טק', 'תעשייה אווירית', 'רפאל', 'אלביט', 'חברת החשמל לישראל', 'חשכ״ל משרד האוצר ומדינת ישראל', 'לא ניגשתי לאף אחת מהחברות הנ"ל דרך חברה כלשהי'].map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.applied_via_other_company.includes(option)}
                          onCheckedChange={() => toggleArrayField('applied_via_other_company', option)}
                        />
                        <Label className="cursor-pointer text-sm">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>החברה אליה אני מגיש/ה מועמדות באמצעות פנדה-טק *</Label>
                  <Input value={formData.applying_to_company} onChange={(e) => updateField('applying_to_company', e.target.value)} required />
                </div>

                <div>
                  <Label>התפקיד אליו אני מתמיין/ת *</Label>
                  <Input value={formData.applying_to_position} onChange={(e) => updateField('applying_to_position', e.target.value)} required />
                </div>

                <div>
                  <Label>ממליצים - שמות וטלפונים של 1-3 ממליצים</Label>
                  <Textarea 
                    value={formData.references} 
                    onChange={(e) => updateField('references', e.target.value)} 
                    rows={4}
                    placeholder="שם: יוסי כהן, טלפון: 050-1234567&#10;שם: דנה לוי, טלפון: 052-9876543"
                  />
                </div>

                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={formData.consent_recruitment_process}
                          onCheckedChange={(val) => updateField('consent_recruitment_process', val)}
                          id="consent1"
                        />
                        <Label htmlFor="consent1" className="cursor-pointer text-sm">
                          אני נותן/ת את הסכמתי המלאה לבצע את תהליך הגיוס לתפקידים המוצעים לי באמצעות פנדה-טק *
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={formData.consent_no_parallel_application}
                          onCheckedChange={(val) => updateField('consent_no_parallel_application', val)}
                          id="consent2"
                        />
                        <Label htmlFor="consent2" className="cursor-pointer text-sm">
                          אני מתחייב/ת לכך שלא אזום פנייה לגופים שפנדה-טק תפנה אותי אליהם באופן ישיר או דרך חברות אחרות *
                        </Label>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* שלב 4: תנאי העסקה */}
            {currentStep === 4 && (
              <>
                <div>
                  <Label>תחום עיסוק מבוקש</Label>
                  <Input value={formData.desired_field} onChange={(e) => updateField('desired_field', e.target.value)} />
                </div>

                <div>
                  <Label>מה התפקיד המרכזי שעבדת בו עד כה?</Label>
                  <Input value={formData.main_role_experience} onChange={(e) => updateField('main_role_experience', e.target.value)} />
                </div>

                <div>
                  <Label>אחוזי משרה אפשרית *</Label>
                  <Select value={String(formData.work_percentage)} onValueChange={(val) => updateField('work_percentage', Number(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="40">40%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>ציפיות שכר ברוטו (מומלץ להיות ריאליים) *</Label>
                  <Input value={formData.salary_expectation} onChange={(e) => updateField('salary_expectation', e.target.value)} placeholder="לדוגמה: 15,000 ₪" required />
                </div>

                <div>
                  <Label>האם נדרש רכב ליסינג? *</Label>
                  <Select value={formData.needs_leasing_car} onValueChange={(val) => updateField('needs_leasing_car', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="כן">כן</SelectItem>
                      <SelectItem value="לא">לא</SelectItem>
                      <SelectItem value="אולי">אולי</SelectItem>
                      <SelectItem value="אחר">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">שים לב: שווי הרכב יורד על פי חוק משכר ברוטו</p>
                </div>

                <div>
                  <Label>האם נדרשות ארוחות צהריים באתר לקוח? *</Label>
                  <Select value={formData.needs_lunch_at_client} onValueChange={(val) => updateField('needs_lunch_at_client', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="כן">כן</SelectItem>
                      <SelectItem value="לא">לא</SelectItem>
                      <SelectItem value="אולי">אולי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>מה התחביבים שלך?</Label>
                  <Textarea value={formData.hobbies} onChange={(e) => updateField('hobbies', e.target.value)} rows={3} />
                </div>

                <div>
                  <Label>מועד תחילת עבודה משוער/אפשרי *</Label>
                  <Input value={formData.expected_start_date} onChange={(e) => updateField('expected_start_date', e.target.value)} type="date" required />
                </div>
              </>
            )}

            {/* שלב 5: סווג בטחוני */}
            {currentStep === 5 && (
              <>
                <div>
                  <Label>סווג בטחוני מוערך *</Label>
                  <Select value={formData.security_clearance} onValueChange={(val) => updateField('security_clearance', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="לא יודע/ת">לא יודע/ת</SelectItem>
                      <SelectItem value="שמור">שמור</SelectItem>
                      <SelectItem value="סודי">סודי</SelectItem>
                      <SelectItem value="סודי ביותר - רמה 3">סודי ביותר - רמה 3</SelectItem>
                      <SelectItem value="ס״מ - רמה 1">ס״מ - רמה 1</SelectItem>
                      <SelectItem value="אחר">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>גורם שביצע את הסווג</Label>
                    <Input value={formData.security_clearance_authority} onChange={(e) => updateField('security_clearance_authority', e.target.value)} />
                  </div>
                  <div>
                    <Label>באיזו שנה בוצע הסווג?</Label>
                    <Input value={formData.security_clearance_year} onChange={(e) => updateField('security_clearance_year', e.target.value)} placeholder="2023" />
                  </div>
                </div>

                <div>
                  <Label>האם יש לך אזרחות נוספת? *</Label>
                  <Select 
                    value={formData.has_other_citizenship === true ? "כן" : formData.has_other_citizenship === false ? "לא" : ""} 
                    onValueChange={(val) => updateField('has_other_citizenship', val === "כן")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="כן">כן</SelectItem>
                      <SelectItem value="לא">לא</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.has_other_citizenship && (
                  <div>
                    <Label>לאיזו מדינה?</Label>
                    <Input value={formData.other_citizenship_country} onChange={(e) => updateField('other_citizenship_country', e.target.value)} />
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>שם קב"ט (לא חובה)</Label>
                    <Input value={formData.security_officer_name} onChange={(e) => updateField('security_officer_name', e.target.value)} />
                  </div>
                  <div>
                    <Label>מספר טלפון של הקב"ט (לא חובה)</Label>
                    <Input value={formData.security_officer_phone} onChange={(e) => updateField('security_officer_phone', e.target.value)} type="tel" />
                  </div>
                </div>

                <div>
                  <Label>צרף/י צילום ת.ז וספח *</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => e.target.files[0] && handleFileUpload('id_photo_url', e.target.files[0])}
                      className="hidden"
                      id="id-upload"
                    />
                    <label htmlFor="id-upload">
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          {uploadingFiles.id_photo_url ? (
                            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעלה...</>
                          ) : formData.id_photo_url ? (
                            <><CheckCircle className="w-4 h-4 ml-2 text-green-600" /> הקובץ הועלה</>
                          ) : (
                            <><Upload className="w-4 h-4 ml-2" /> העלה צילום ת.ז</>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>צרף/י תמונת פרופיל על רקע בהיר (לאישורי כניסה)</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files[0] && handleFileUpload('profile_image_url', e.target.files[0])}
                      className="hidden"
                      id="profile-upload"
                    />
                    <label htmlFor="profile-upload">
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          {uploadingFiles.profile_image_url ? (
                            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעלה...</>
                          ) : formData.profile_image_url ? (
                            <><CheckCircle className="w-4 h-4 ml-2 text-green-600" /> התמונה הועלתה</>
                          ) : (
                            <><Upload className="w-4 h-4 ml-2" /> העלה תמונת פרופיל</>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* שלב 6: השכלה */}
            {currentStep === 6 && (
              <>
                <div>
                  <Label>תעודת השכלה ראשונה - טכנאי/הנדסאי/תואר ראשון (שם התואר והמוסד, שנת סיום)</Label>
                  <Input value={formData.education_1} onChange={(e) => updateField('education_1', e.target.value)} placeholder="תואר ראשון במדעי המחשב, אוניברסיטת תל אביב, 2020" />
                </div>

                <div>
                  <Label>תעודת השכלה שנייה - תואר ראשון/שני</Label>
                  <Input value={formData.education_2} onChange={(e) => updateField('education_2', e.target.value)} />
                </div>

                <div>
                  <Label>תעודת השכלה שלישית - תואר שני/שלישי</Label>
                  <Input value={formData.education_3} onChange={(e) => updateField('education_3', e.target.value)} />
                </div>

                <div>
                  <Label>צילומי תעודות שכר (העלאת מספר קבצים)</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(e) => e.target.files.length > 0 && handleMultiFileUpload('education_certificates_urls', Array.from(e.target.files))}
                      className="hidden"
                      id="certificates-upload"
                    />
                    <label htmlFor="certificates-upload">
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          {uploadingFiles.education_certificates_urls ? (
                            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעלה...</>
                          ) : formData.education_certificates_urls?.length > 0 ? (
                            <><CheckCircle className="w-4 h-4 ml-2 text-green-600" /> {formData.education_certificates_urls.length} קבצים הועלו</>
                          ) : (
                            <><Upload className="w-4 h-4 ml-2" /> העלה תעודות</>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>קורות חיים (קובץ עדכני)</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => e.target.files[0] && handleFileUpload('resume_file_url', e.target.files[0])}
                      className="hidden"
                      id="resume-upload"
                    />
                    <label htmlFor="resume-upload">
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          {uploadingFiles.resume_file_url ? (
                            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעלה...</>
                          ) : formData.resume_file_url ? (
                            <><CheckCircle className="w-4 h-4 ml-2 text-green-600" /> הקובץ הועלה</>
                          ) : (
                            <><Upload className="w-4 h-4 ml-2" /> העלה קורות חיים</>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="font-semibold mb-4">מקומות עבודה קודמים</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">מקום עבודה קודם 1</h4>
                      <Input 
                        placeholder="שם מקום עבודה" 
                        value={formData.job_1_company} 
                        onChange={(e) => updateField('job_1_company', e.target.value)} 
                      />
                      <Input 
                        placeholder="מועד סיום" 
                        value={formData.job_1_end_date} 
                        onChange={(e) => updateField('job_1_end_date', e.target.value)} 
                      />
                      <Textarea 
                        placeholder="סיבת סיום עבודה" 
                        value={formData.job_1_end_reason} 
                        onChange={(e) => updateField('job_1_end_reason', e.target.value)} 
                        rows={2}
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">מקום עבודה קודם 2</h4>
                      <Input 
                        placeholder="שם מקום עבודה" 
                        value={formData.job_2_company} 
                        onChange={(e) => updateField('job_2_company', e.target.value)} 
                      />
                      <Input 
                        placeholder="מועד סיום" 
                        value={formData.job_2_end_date} 
                        onChange={(e) => updateField('job_2_end_date', e.target.value)} 
                      />
                      <Textarea 
                        placeholder="סיבת סיום עבודה" 
                        value={formData.job_2_end_reason} 
                        onChange={(e) => updateField('job_2_end_reason', e.target.value)} 
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* שלב 7: שירות צבאי */}
            {currentStep === 7 && (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-4">נתוני שרות צבאי</h3>
                  <p className="text-sm text-gray-600 mb-4">עזור/י לנו להכיר אותך טוב יותר</p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>דרגה בשרות חובה/קבע</Label>
                      <Input value={formData.military_rank} onChange={(e) => updateField('military_rank', e.target.value)} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>שנת גיוס</Label>
                        <Input value={formData.military_recruitment_year} onChange={(e) => updateField('military_recruitment_year', e.target.value)} placeholder="2015" />
                      </div>
                      <div>
                        <Label>שנת שחרור</Label>
                        <Input value={formData.military_discharge_year} onChange={(e) => updateField('military_discharge_year', e.target.value)} placeholder="2018" />
                      </div>
                    </div>

                    <div>
                      <Label>מקצוע צבאי</Label>
                      <Input value={formData.military_service} onChange={(e) => updateField('military_service', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>הערות נוספות *</Label>
                  <Textarea 
                    value={formData.additional_notes} 
                    onChange={(e) => updateField('additional_notes', e.target.value)} 
                    rows={4}
                    placeholder='אם יש לך נושא שחשוב שנדע או משהו ששכחת לציין, אנא רשום כאן. אם אין - רשום "אין"'
                    required
                  />
                </div>

                {submitStatus?.type === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submitStatus.message}</AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setValidationError(null);
                    setCurrentStep(currentStep - 1);
                  }}
                >
                  חזור
                </Button>
              )}
              
              <div className="mr-auto">
                {currentStep < 7 ? (
                  <Button 
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    המשך
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> שומר...</>
                    ) : (
                      'שלח טופס'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 Pandatech - שאלון קליטת מועמדים</p>
        </div>
      </div>
    </div>
  );
}