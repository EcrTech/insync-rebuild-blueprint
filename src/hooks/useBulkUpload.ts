import { useState } from "react";
import { useNotification } from "./useNotification";
import { parseCSV } from "@/utils/csvParser";

export interface BulkUploadState {
  isOpen: boolean;
  uploading: boolean;
  file: File | null;
  openDialog: () => void;
  closeDialog: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: (onUpload: (data: any[]) => Promise<void>, identifierType?: 'phone' | 'email') => Promise<void>;
}

/**
 * Hook for managing bulk CSV upload functionality
 * Handles file selection, parsing, and upload operations
 */
export function useBulkUpload(): BulkUploadState {
  const notify = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const openDialog = () => {
    setIsOpen(true);
    setFile(null);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        notify.error("Invalid file type", "Please select a CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async (
    onUpload: (data: any[]) => Promise<void>,
    identifierType: 'phone' | 'email' = 'email'
  ) => {
    if (!file) {
      notify.error("No file selected", "Please select a CSV file to upload");
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const parsedData = parseCSV(text, identifierType);
      
      if (parsedData.errors.length > 0) {
        notify.error("Validation errors", parsedData.errors.join(', '));
        return;
      }

      if (parsedData.rows.length === 0) {
        notify.error("Empty file", "The CSV file has no valid data rows");
        return;
      }

      await onUpload(parsedData.rows);
      
      notify.success("Upload successful", `Imported ${parsedData.rows.length} records`);
      closeDialog();
    } catch (error: any) {
      notify.error("Upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  return {
    isOpen,
    uploading,
    file,
    openDialog,
    closeDialog,
    handleFileChange,
    handleUpload,
  };
}
