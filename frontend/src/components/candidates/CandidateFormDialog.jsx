import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Loader2 } from "lucide-react";
import CandidateStatusSelector from "./CandidateStatusSelector";
import { Employee } from "@/entities/Employee";

function ProfileImageUpload({ currentImageUrl, onUploadSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);

  useEffect(() => {
    setPreviewUrl(currentImageUrl);
  }, [currentImageUrl]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('רק קבצי תמונה מותרים.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newImageUrl = `https://picsum.photos/seed/${Date.now()}/100/100`;
      onUploadSuccess(newImageUrl);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("העלאת התמונה נכשלה. אנא נסה שוב.");
      setPreviewUrl(currentImageUrl);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-4 mb-4">
      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 relative">
        {previewUrl ? (
          <img src={previewUrl} alt="תצוגה מקדימה של תמונה" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Users className="w-12 h-12 text-gray-400" />
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="profile-image-upload" className="sr-only">העלה תמונת פרופיל</Label>
        <Input
          id="profile-image-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          disabled={isLoading}
        />
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    </div>
  );
}

export default function CandidateForm({ candidate, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_primary: "",
    phone_secondary: "",
    address: "",
    education: "",
    skills_summary: "",
    security_clearance: "לא רלוונטי",
    status: "מועמד",
    profile_image_url: "",
    referred_by_employee_name: "",
    referred_by_employee_id: "",
    ...candidate
  });

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const employeesList = await Employee.filter({ status: 'פעיל' });
        setEmployees(employeesList);
      } catch (error) {
        console.error('Error loading employees:', error);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, []);

  const handleImageUploadSuccess = (imageUrl) => {
    setFormData(prev => ({ ...prev, profile_image_url: imageUrl }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      alert("אנא מלא שם פרטי ושם משפחה");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ProfileImageUpload 
        currentImageUrl={formData.profile_image_url} 
        onUploadSuccess={handleImageUploadSuccess} 
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="שם פרטי *"
          value={formData.first_name}
          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
          required
        />
        <Input
          placeholder="שם משפחה *"
          value={formData.last_name}
          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
          required
        />
      </div>

      <Input
        placeholder="אימייל"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="טלפון ראשי"
          value={formData.phone_primary}
          onChange={(e) => setFormData({...formData, phone_primary: e.target.value})}
        />
        <Input
          placeholder="טלפון נוסף"
          value={formData.phone_secondary}
          onChange={(e) => setFormData({...formData, phone_secondary: e.target.value})}
        />
      </div>

      <Input
        placeholder="מקום מגורים"
        value={formData.address}
        onChange={(e) => setFormData({...formData, address: e.target.value})}
      />
      
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="תארים ולימודים"
          value={formData.education}
          onChange={(e) => setFormData({...formData, education: e.target.value})}
        />
        <div>
          <Label htmlFor="employee-referral">חבר מביא חבר</Label>
          <Select 
            value={formData.referred_by_employee_id || "none"} 
            onValueChange={(value) => {
              if (value === "none") {
                setFormData({
                  ...formData, 
                  referred_by_employee_id: "",
                  referred_by_employee_name: "",
                  is_employee_referral: false
                });
              } else {
                const employee = employees.find(e => e.id === value);
                setFormData({
                  ...formData, 
                  referred_by_employee_id: value,
                  referred_by_employee_name: employee?.full_name || "",
                  is_employee_referral: true,
                  referral_date: new Date().toISOString(),
                  how_found_pandatech: ['חבר מביא חבר']
                });
              }
            }}
          >
            <SelectTrigger id="employee-referral" className="mt-1">
              <SelectValue placeholder={loadingEmployees ? "טוען..." : "בחר עובד מפנה"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">אין - לא הופנה על ידי עובד</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.department || emp.position || 'עובד'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="security_clearance">סיווג בטחוני</Label>
        <Select value={formData.security_clearance} onValueChange={(value) => setFormData({...formData, security_clearance: value})}>
          <SelectTrigger id="security_clearance" className="mt-1">
            <SelectValue placeholder="בחר סיווג בטחוני" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="רמה 1">רמה 1</SelectItem>
            <SelectItem value="רמה 2">רמה 2</SelectItem>
            <SelectItem value="רמה 3">רמה 3</SelectItem>
            <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
            <SelectItem value="ללא סווג">ללא סווג</SelectItem>
            <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>סטטוס המועמד (לפי טבלת מצבים)</Label>
        <div className="mt-1">
          <CandidateStatusSelector 
            candidate={formData} 
            onStatusChange={(updatedCandidate) => {
              setFormData(prev => ({
                ...prev,
                status: updatedCandidate.status,
                status_number: updatedCandidate.status_number
              }));
            }}
          />
        </div>
      </div>

      <textarea
        placeholder="סיכום יכולות וכישורים"
        value={formData.skills_summary}
        onChange={(e) => setFormData({...formData, skills_summary: e.target.value})}
        rows={4}
        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {candidate ? "עדכן מועמד" : "צור מועמד"}
        </Button>
      </div>
    </form>
  );
}