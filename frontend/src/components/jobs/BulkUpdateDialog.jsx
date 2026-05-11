import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Eye, Loader2, CheckSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BulkUpdateDialog({ isOpen, onClose, selectedJobIds, onSuccess }) {
  const [updating, setUpdating] = useState(false);
  const [updateData, setUpdateData] = useState({
    updateStatus: false,
    status: "",
    updateDoNotPublish: false,
    do_not_publish: false
  });

  const handleUpdate = async () => {
    if (!updateData.updateStatus && !updateData.updateDoNotPublish) {
      alert("נא לבחור לפחות שדה אחד לעדכון");
      return;
    }

    setUpdating(true);
    try {
      const jobIdsArray = Array.from(selectedJobIds);
      const updateFields = {};

      if (updateData.updateStatus && updateData.status) {
        updateFields.status = updateData.status;
      }

      if (updateData.updateDoNotPublish) {
        updateFields.do_not_publish = updateData.do_not_publish;
      }

      // Update each job
      for (const jobId of jobIdsArray) {
        await base44.entities.Job.update(jobId, updateFields);
      }

      alert(`${jobIdsArray.length} משרות עודכנו בהצלחה`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating jobs:", error);
      alert("שגיאה בעדכון המשרות");
    }
    setUpdating(false);
  };

  const handleCancel = () => {
    setUpdateData({
      updateStatus: false,
      status: "",
      updateDoNotPublish: false,
      do_not_publish: false
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>עדכון מרובה - {selectedJobIds.size} משרות</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Update Section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="update-status"
                checked={updateData.updateStatus}
                onCheckedChange={(checked) => setUpdateData({...updateData, updateStatus: checked})}
              />
              <Label htmlFor="update-status" className="font-semibold cursor-pointer">
                עדכן סטטוס
              </Label>
            </div>
            
            {updateData.updateStatus && (
              <Select 
                value={updateData.status} 
                onValueChange={(value) => setUpdateData({...updateData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="פעילה">פעילה</SelectItem>
                  <SelectItem value="סגורה">סגורה</SelectItem>
                  <SelectItem value="מושהית">מושהית</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Do Not Publish Section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="update-publish"
                checked={updateData.updateDoNotPublish}
                onCheckedChange={(checked) => setUpdateData({...updateData, updateDoNotPublish: checked})}
              />
              <Label htmlFor="update-publish" className="font-semibold cursor-pointer">
                עדכן הגדרות פרסום
              </Label>
            </div>
            
            {updateData.updateDoNotPublish && (
              <div className="flex items-center space-x-2 space-x-reverse p-3 bg-gray-50 rounded-lg border">
                <Checkbox
                  id="do-not-publish"
                  checked={updateData.do_not_publish}
                  onCheckedChange={(checked) => setUpdateData({...updateData, do_not_publish: checked})}
                />
                <Label htmlFor="do-not-publish" className="text-sm cursor-pointer flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  לא לפרסום
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            disabled={updating}
            className="w-full sm:w-auto"
          >
            ביטול
          </Button>
          <Button 
            onClick={handleUpdate}
            disabled={updating || (!updateData.updateStatus && !updateData.updateDoNotPublish)}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
          >
            {updating ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מעדכן...
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4 ml-2" />
                עדכן משרות
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}