import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Upload, X } from "lucide-react";
import { uploadPhoto } from "@/lib/photoUpload";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    timeOfBirth: "",
    placeOfBirth: "",
    profession: "",
    phoneNumber: "",
    city: "",
    salaryRange: "",
    interests: "",
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photos.length + files.length > 6) {
      toast({
        title: "Too many photos",
        description: "You can upload up to 6 photos",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          toast({
            title: "Invalid file type",
            description: "Please upload only image files",
            variant: "destructive",
          });
          continue;
        }
        const url = await uploadPhoto(file, user.id, photos.length + i);
        uploadedUrls.push(url);
        setPhotoFiles((prev) => [...prev, file]);
      }
      setPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({
        title: "Missing information",
        description: "Please select your date of birth",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.profession || !formData.phoneNumber || !formData.city || !formData.salaryRange) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload photos if any
      let uploadedPhotoUrls: string[] = [];
      if (photoFiles.length > 0) {
        for (let i = 0; i < photoFiles.length; i++) {
          const url = await uploadPhoto(photoFiles[i], user.id, i);
          uploadedPhotoUrls.push(url);
        }
      }
      // Use existing photos if no new uploads
      if (uploadedPhotoUrls.length === 0 && photos.length > 0) {
        uploadedPhotoUrls = photos;
      }

      // Update profile with new fields
      const interestsArray = formData.interests
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          photos: uploadedPhotoUrls,
          profile_photo_url: uploadedPhotoUrls[0] || null,
          profession: formData.profession,
          phone_number: formData.phoneNumber,
          city: formData.city,
          salary_range: formData.salaryRange,
          interests: interestsArray,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Upsert birth details
      const { error: birthError } = await supabase
        .from("birth_details")
        .upsert(
          {
            user_id: user.id,
            date_of_birth: format(date!, "yyyy-MM-dd"),
            time_of_birth: formData.timeOfBirth,
            place_of_birth: formData.placeOfBirth,
          },
          { onConflict: "user_id" }
        );

      if (birthError) throw birthError;

      // Generate kundli
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, gender")
        .eq("id", user.id)
        .single();

      const { data: kundliResponse, error: kundliError } = await supabase.functions.invoke(
        "generate-kundli",
        {
          body: {
            dateOfBirth: format(date!, "yyyy-MM-dd"),
            timeOfBirth: formData.timeOfBirth,
            placeOfBirth: formData.placeOfBirth,
            name: profileData?.name,
            gender: profileData?.gender,
          },
        }
      );

      if (kundliError) throw kundliError;
      if (!kundliResponse || !kundliResponse.kundli) {
        throw new Error("Failed to generate kundli");
      }

      // Store kundli
      const { error: storeError } = await supabase
        .from("kundli_data")
        .upsert(
          {
            user_id: user.id,
            kundli_json: kundliResponse.kundli,
          },
          { onConflict: "user_id" }
        );

      if (storeError) throw storeError;

      toast({
        title: "Profile completed!",
        description: "Your profile has been created successfully.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-display text-center">
            Complete Your Profile {step === 1 ? "(Step 1/2)" : "(Step 2/2)"}
          </CardTitle>
          <p className="text-muted-foreground text-center">
            {step === 1
              ? "We need your birth details to generate your kundli"
              : "Add your profile information"}
          </p>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      captionLayout="dropdown-buttons"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tob">Time of Birth</Label>
                <Input
                  id="tob"
                  type="time"
                  value={formData.timeOfBirth}
                  onChange={(e) => setFormData({ ...formData, timeOfBirth: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pob">Place of Birth</Label>
                <Input
                  id="pob"
                  type="text"
                  placeholder="City, Country"
                  value={formData.placeOfBirth}
                  onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Next Step
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Photos (up to 6)</Label>
                <div className="grid grid-cols-3 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {photos.length < 6 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-primary transition-colors"
                    >
                      <Upload className="h-6 w-6 mb-2" />
                      <span className="text-xs">Add Photo</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profession">Profession *</Label>
                <Input
                  id="profession"
                  type="text"
                  placeholder="e.g., Software Engineer, Doctor, Teacher"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="e.g., Mumbai, Delhi, Bangalore"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary">Salary/Income Range *</Label>
                <Select
                  value={formData.salaryRange}
                  onValueChange={(value) => setFormData({ ...formData, salaryRange: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select income range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="below-5lakh">Below ₹5 Lakh</SelectItem>
                    <SelectItem value="5-10lakh">₹5-10 Lakh</SelectItem>
                    <SelectItem value="10-20lakh">₹10-20 Lakh</SelectItem>
                    <SelectItem value="20-50lakh">₹20-50 Lakh</SelectItem>
                    <SelectItem value="50lakh-plus">₹50 Lakh+</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Interests (comma-separated)</Label>
                <Input
                  id="interests"
                  type="text"
                  placeholder="e.g., Reading, Travel, Music, Cooking"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple interests with commas
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating profile...
                    </>
                  ) : (
                    "Complete Profile"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
