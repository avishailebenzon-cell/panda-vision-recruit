import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadFile } from "@/integrations/Core";
import { User, X, RefreshCw, Camera } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

export default function ProfileImageUpload({ currentImageUrl, onImageChange, candidateName = "מועמד" }) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [previewUrl, setPreviewUrl] = useState(currentImageUrl);

    // Compress and resize image before upload
    const compressImage = useCallback((file, maxWidth = 300, maxHeight = 300, quality = 0.8) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions maintaining aspect ratio
                let { width, height } = img;
                const aspectRatio = width / height;

                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / aspectRatio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * aspectRatio;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }, []);

    const handleFileSelect = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setUploadError("אנא בחר קובץ תמונה בלבד (JPG, PNG, GIF)");
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError("גודל התמונה חייב להיות מתחת ל-10MB");
            return;
        }

        setIsUploading(true);
        setUploadError("");

        try {
            // Compress image
            const compressedFile = await compressImage(file);
            
            // Upload compressed image
            const uploadResult = await UploadFile({ file: compressedFile });
            
            if (uploadResult.file_url) {
                setPreviewUrl(uploadResult.file_url);
                onImageChange(uploadResult.file_url);
            } else {
                throw new Error("לא התקבל קישור לתמונה");
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            setUploadError(`שגיאה בהעלאת התמונה: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    }, [compressImage, onImageChange]);

    const handleRemoveImage = useCallback(() => {
        setPreviewUrl(null);
        onImageChange(null);
    }, [onImageChange]);

    return (
        <div className="space-y-3">
            <Label className="text-sm font-medium">תמונת פרופיל</Label>
            
            <div className="flex items-start gap-4">
                {/* Image Preview */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        {previewUrl ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="relative group"
                            >
                                <img
                                    src={previewUrl}
                                    alt={`תמונת פרופיל של ${candidateName}`}
                                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shadow-sm"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRemoveImage}
                                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center"
                            >
                                <User className="w-8 h-8 text-gray-400" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploading}
                            onClick={() => document.getElementById('profile-image-input')?.click()}
                            className="flex items-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    מעלה...
                                </>
                            ) : (
                                <>
                                    <Camera className="w-4 h-4" />
                                    {previewUrl ? 'החלף תמונה' : 'העלה תמונה'}
                                </>
                            )}
                        </Button>
                        
                        {previewUrl && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRemoveImage}
                                className="text-red-600 hover:text-red-700"
                            >
                                הסר תמונה
                            </Button>
                        )}
                    </div>
                    
                    <p className="text-xs text-gray-500">
                        מומלץ: תמונה מרובעת, עד 10MB. התמונה תכווץ אוטומטית ל-300×300 פיקסלים.
                    </p>
                </div>
            </div>

            {/* Hidden File Input */}
            <input
                id="profile-image-input"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Error Display */}
            {uploadError && (
                <Alert variant="destructive">
                    <AlertDescription className="text-sm">
                        {uploadError}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}