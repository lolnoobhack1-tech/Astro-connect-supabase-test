import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "profile-photos";

export async function uploadPhoto(file: File, userId: string, photoIndex?: number): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = photoIndex !== undefined 
    ? `${userId}/${photoIndex}-${Date.now()}.${fileExt}`
    : `${userId}/profile-${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function deletePhoto(fileUrl: string): Promise<void> {
  const fileName = fileUrl.split("/").pop()?.split("?")[0];
  if (!fileName) return;

  const pathParts = fileUrl.split("/");
  const bucketIndex = pathParts.findIndex(part => part === BUCKET_NAME);
  if (bucketIndex === -1) return;

  const fullPath = pathParts.slice(bucketIndex + 1).join("/");

  await supabase.storage
    .from(BUCKET_NAME)
    .remove([fullPath]);
}

