import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export interface Attachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size?: number;
}

interface AttachmentManagerProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  orgId: string;
}

export const AttachmentManager = ({ attachments, onChange, orgId }: AttachmentManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileSize = file.size;
    const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);

    // Check file size limits
    if (fileSize > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB per file",
        variant: "destructive",
      });
      return;
    }

    if (totalSize + fileSize > 10 * 1024 * 1024) {
      toast({
        title: "Total size exceeded",
        description: "Total attachments size cannot exceed 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orgId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('email-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('email-attachments')
        .getPublicUrl(fileName);

      const fileType = file.type.startsWith('video/') ? 'video' : 'image';

      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        type: fileType,
        url: publicUrl,
        name: file.name,
        size: fileSize,
      };

      onChange([...attachments, newAttachment]);

      toast({
        title: "File uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    try {
      const path = attachment.url.split('/email-attachments/')[1];
      if (path) {
        await supabase.storage.from('email-attachments').remove([path]);
      }
      onChange(attachments.filter(att => att.id !== attachment.id));
      toast({
        title: "Attachment removed",
        description: `${attachment.name} has been removed`,
      });
    } catch (error) {
      console.error('Remove error:', error);
      toast({
        title: "Error",
        description: "Failed to remove attachment",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Attachments (Images & Videos)</Label>
        <div className="text-xs text-muted-foreground">
          Max 5MB per file, 10MB total
        </div>
      </div>

      <div>
        <input
          type="file"
          id="attachment-upload"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,video/mp4,video/webm"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('attachment-upload')?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </div>

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <Card key={attachment.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {attachment.type === 'image' ? (
                    <Image className="h-8 w-8 text-blue-500" />
                  ) : (
                    <Video className="h-8 w-8 text-purple-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.type.toUpperCase()} · {formatFileSize(attachment.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(attachment)}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {attachments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments added. Upload images or videos to include in your email.
        </p>
      )}
    </div>
  );
};
