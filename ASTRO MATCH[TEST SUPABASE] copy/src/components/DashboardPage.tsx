import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart, X, Sparkles, User, LogOut, Phone, MapPin, Briefcase, DollarSign, Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
interface Profile {
  id: string;
  name: string;
  gender: string;
  profile_photo_url?: string;
  photos?: string[];
  profession?: string;
  phone_number?: string;
  city?: string;
  salary_range?: string;
  interests?: string[];
}

interface CompatibilityBreakdown {
  Varna: number;
  Vashya: number;
  Tara: number;
  Yoni: number;
  "Graha Maitri": number;
  Gana: number;
  Bhakoot: number;
  Nadi: number;
}

interface CompatibilityResult {
  total_gunas: number;
  max_gunas: number;
  verdict: string;
  breakdown: CompatibilityBreakdown;
}

// Define the max points for each Koota (Constant)
const KOOTA_MAX: Record<string, number> = {
  Varna: 1,
  Vashya: 2,
  Tara: 3,
  Yoni: 4,
  "Graha Maitri": 5,
  Gana: 6,
  Bhakoot: 7,
  Nadi: 8,
};


export const DashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [compatibility, setCompatibility] = useState<{ [key: string]: CompatibilityResult }>({});
  const [kundliData, setKundliData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("discover");
  const [matches, setMatches] = useState<Profile[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get current user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setCurrentUser(profile);

      // Check if user has completed onboarding
      const { data: birthDetails } = await supabase
        .from("birth_details")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!birthDetails) {
        navigate("/onboarding");
        return;
      }

      // Get user's kundli; if missing but birth details exist (legacy users),
      // auto-generate and store it so compatibility can be calculated.
      let { data: kundli } = await supabase
        .from("kundli_data")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!kundli) {
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, gender")
            .eq("id", user.id)
            .single();

          const { data: kundliResponse, error: kundliError } = await supabase.functions.invoke(
            "generate-kundli",
            {
              body: {
                // Postgres date comes back as YYYY-MM-DD, which the engine expects
                dateOfBirth: (birthDetails as any).date_of_birth,
                timeOfBirth: (birthDetails as any).time_of_birth,
                placeOfBirth: (birthDetails as any).place_of_birth,
                name: profileData?.name,
                gender: profileData?.gender,
              },
            }
          );

          if (kundliError || !kundliResponse || !kundliResponse.kundli) {
            console.error("Auto-kundli generation failed on dashboard:", kundliError || kundliResponse);
          } else {
            const { error: storeError } = await supabase
              .from("kundli_data")
              .upsert(
                {
                  user_id: user.id,
                  kundli_json: kundliResponse.kundli,
                },
                { onConflict: "user_id" }
              );

            if (storeError) {
              console.error("Failed to store auto-generated kundli on dashboard:", storeError);
            } else {
              kundli = { user_id: user.id, kundli_json: kundliResponse.kundli } as any;
            }
          }
        } catch (e) {
          console.error("Error while auto-generating kundli on dashboard:", e);
        }
      }

      setKundliData(kundli);

      // Get other profiles (excluding current user and already interacted)
      const { data: interactions } = await supabase
        .from("match_interactions")
        .select("target_user_id")
        .eq("user_id", user.id);

      const interactedIds = interactions?.map((i) => i.target_user_id) || [];

      let query = supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id);

      if (interactedIds.length > 0) {
        query = query.not("id", "in", `(${interactedIds.join(",")})`);
      }

      const { data: otherProfiles } = await query;


      if (otherProfiles && otherProfiles.length > 0) {
        setProfiles(otherProfiles);
        // Load compatibility scores
        loadCompatibility(user.id, otherProfiles);
      }

      // Load matches
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (matchesError) {
        console.error("Error loading matches:", matchesError);
      }

      if (matchesData && matchesData.length > 0) {
        const matchedUserIds = matchesData.map((match: any) => 
          match.user1_id === user.id ? match.user2_id : match.user1_id
        );
        
        const { data: matchedProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", matchedUserIds);
        
        if (matchedProfiles) {
          setMatches(matchedProfiles);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load profiles",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompatibility = async (userId: string, targetProfiles: Profile[]) => {
    const scores: { [key: string]: CompatibilityResult } = {};

    for (const profile of targetProfiles) {
      try {
        // 1) Prefer stored compatibility score from the backend
        const { data: storedCompat, error: storedError } = await supabase
          .from("compatibility_scores")
          .select("score, details")
          .or(
            `and(user1_id.eq.${userId},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${userId})`,
          )
          .maybeSingle();

        if (storedError) {
          console.error("Error fetching stored compatibility", { userId, targetUserId: profile.id, storedError });
        }

        let source: any = storedCompat ?? null;

        if (source) {
          console.log("Using stored compatibility score", {
            userId,
            targetUserId: profile.id,
            score: source.score,
          });
        }

        // 2) If we don't have a stored score yet, attempt to calculate and persist via backend function
        if (!source) {
          // Ensure both users have kundli data before calling the compatibility engine
          // Let the backend decide whether kundli data is complete for both users.
          // It will gracefully return a non-fatal response if kundli is missing.

          console.log("Invoking calculate-compatibility", { userId, targetUserId: profile.id });

          const { data: calcResult, error: calcError } = await supabase.functions.invoke("calculate-compatibility", {
            body: { user1Id: userId, user2Id: profile.id },
          });

          if (calcError) {
            console.error("Error from calculate-compatibility", { userId, targetUserId: profile.id, calcError });
            continue;
          }

          if (!calcResult) {
            console.warn("Empty compatibility result from backend", { userId, targetUserId: profile.id });
            continue;
          }

          source = { score: (calcResult as any).score ?? null, details: calcResult } as any;

          console.log("Calculated compatibility via backend", {
            userId,
            targetUserId: profile.id,
            score: source.score,
          });
        }

        // 3) Normalise Ashta Koota schema from stored/returned details
        const details: any = (source as any).details ?? source;
        let ashta: any = null;

        if (details?.ashta_koot_raw) {
          ashta = details.ashta_koot_raw;
        } else if (details?.analysis) {
          if (typeof details.analysis === "string") {
            try {
              const parsed = JSON.parse(details.analysis);
              ashta = parsed?.ashta_koot_raw ?? parsed;
            } catch (e) {
              console.warn("Failed to parse details.analysis as JSON", {
                userId,
                targetUserId: profile.id,
                error: e,
              });
            }
          } else if (typeof details.analysis === "object") {
            ashta = (details.analysis as any).ashta_koot_raw ?? details.analysis;
          }
        }

        // Fallback: some engines return the Ashta Koota object directly at the root
        if (!ashta && details && typeof details.total_gunas === "number" && details.breakdown) {
          ashta = details;
        }


        if (!ashta || typeof ashta.total_gunas !== "number" || !ashta.breakdown) {
          console.warn("Dropping compatibility result due to missing Ashta Koota fields", {
            userId,
            targetUserId: profile.id,
            details,
          });
          continue;
        }

        const rawMax = typeof ashta.max_gunas === "number" && ashta.max_gunas > 0 ? ashta.max_gunas : 36;
        const clampedTotal = Math.min(Math.max(ashta.total_gunas, 0), rawMax);

        if (clampedTotal > rawMax) {
          console.warn("Dropping compatibility result due to invalid clamped total_gunas", {
            userId,
            targetUserId: profile.id,
            ashta,
            clampedTotal,
            rawMax,
          });
          continue;
        }

        console.log("Using compatibility result", {
          userId,
          targetUserId: profile.id,
          total_gunas: clampedTotal,
          max_gunas: rawMax,
          verdict: ashta.verdict,
        });

        scores[profile.id] = {
          total_gunas: clampedTotal,
          max_gunas: rawMax,
          verdict: ashta.verdict ?? "",
          breakdown: ashta.breakdown,
        } as CompatibilityResult;
      } catch (error) {
        console.error(`Failed to load compatibility for ${profile.id}:`, error);
      }
    }

    setCompatibility(scores);
  };
  const handleSwipe = async (action: "pass" | "interest") => {
    if (!currentUser || currentIndex >= profiles.length) return;

    const targetProfile = profiles[currentIndex];

    try {
      const { error } = await supabase.from("match_interactions").insert({
        user_id: currentUser.id,
        target_user_id: targetProfile.id,
        action,
      });

      if (error) throw error;

      if (action === "interest") {
        // Check if it's a mutual match
        const { data: reverseMatch } = await supabase
          .from("match_interactions")
          .select("*")
          .eq("user_id", targetProfile.id)
          .eq("target_user_id", currentUser.id)
          .eq("action", "interest")
          .maybeSingle();

        if (reverseMatch) {
          // Mutual match! Reload matches
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: matchesData } = await supabase
              .from("matches")
              .select("*")
              .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

            if (matchesData && matchesData.length > 0) {
              const matchedUserIds = matchesData.map((match: any) => 
                match.user1_id === user.id ? match.user2_id : match.user1_id
              );
              
              const { data: matchedProfiles } = await supabase
                .from("profiles")
                .select("*")
                .in("id", matchedUserIds);
              
              if (matchedProfiles) {
                setMatches(matchedProfiles);
              }
            }
          }

          toast({
            title: "It's a Match! 🎉",
            description: `You and ${targetProfile.name} have matched! Phone numbers are now visible.`,
          });
        } else {
          toast({
            title: "Interest shown!",
            description: `You've shown interest in ${targetProfile.name}`,
          });
        }
      }

      setCurrentIndex((prev) => prev + 1);
    } catch (error: any) {
      console.error("Swipe error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record action",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Astro Match
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="matches">Matches {matches.length > 0 && `(${matches.length})`}</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            {currentProfile ? (
              <div className="max-w-md mx-auto">
                <Card className="overflow-hidden shadow-card animate-scale-in">
                  <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
                    {currentProfile.photos && currentProfile.photos.length > 0 ? (
                      <img
                        src={currentProfile.photos[0]}
                        alt={currentProfile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : currentProfile.profile_photo_url ? (
                      <img
                        src={currentProfile.profile_photo_url}
                        alt={currentProfile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-32 h-32 text-muted-foreground" />
                    )}
                    
                    {compatibility[currentProfile.id] && (() => {
                      const result = compatibility[currentProfile.id];
                      if (!result || !result.breakdown || result.total_gunas > result.max_gunas) {
                        return null;
                      }
                      const percentage = Math.round((result.total_gunas / result.max_gunas) * 100);
                      return (
                        <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span className="font-bold">{percentage}%</span>
                          <span className="text-xs">Match</span>
                        </div>
                      );
                    })()}

                  </div>
                  
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-display font-bold mb-2">
                      {currentProfile.name}
                    </h2>
                    <div className="space-y-2 mb-4">
                      <p className="text-muted-foreground capitalize">
                        {currentProfile.gender}
                      </p>
                      {currentProfile.profession && (
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <span>{currentProfile.profession}</span>
                        </div>
                      )}
                      {currentProfile.city && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{currentProfile.city}</span>
                        </div>
                      )}
                      {currentProfile.salary_range && (
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="capitalize">
                            {currentProfile.salary_range.replace(/-/g, " - ").replace("lakh", " Lakh")}
                          </span>
                        </div>
                      )}
                      {currentProfile.interests && currentProfile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {currentProfile.interests.map((interest, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {compatibility[currentProfile.id] && (
                      <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-primary mb-1">
                          Astro Compatibility
                        </p>
                        {(() => {
                          const result = compatibility[currentProfile.id];
                          if (!result || !result.breakdown || result.total_gunas > result.max_gunas) {
                            return null;
                          }
                          const percentage = Math.round((result.total_gunas / result.max_gunas) * 100);
                          return (
                            <p className="text-sm text-muted-foreground">
                              Your astrological charts show {percentage}% compatibility
                            </p>
                          );
                        })()}
                      </div>
                    )}


                    {compatibility[currentProfile.id] && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            View Ashta Koota scorecard
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Ashta Koota Compatibility</DialogTitle>
                            <DialogDescription>
                              Traditional Parāśara Ashta Koota scorecard for this match.
                            </DialogDescription>
                          </DialogHeader>
                          {(() => {
                            const result = compatibility[currentProfile.id];
                            if (!result || !result.breakdown || result.total_gunas > result.max_gunas) {
                              return null;
                            }
                            const percentage = Math.round((result.total_gunas / result.max_gunas) * 100);
                            const isGoodMatch = result.total_gunas >= 18;
                            return (
                              <div className="space-y-6 mt-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-full border-4 border-primary/40 bg-primary/5 flex flex-col items-center justify-center">
                                      <span className="text-lg font-bold">
                                        {result.total_gunas}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                        / {result.max_gunas} Gunas
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                        Overall Verdict
                                      </p>
                                      <Badge variant={isGoodMatch ? "default" : "destructive"}>
                                        {result.verdict}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground mb-1">Overall Match%</p>
                                    <p className="text-xl font-semibold">{percentage}%</p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-semibold mb-3">Ashta Koota Breakdown</p>
                                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                    {Object.entries(result.breakdown).map(([koota, score]) => {
                                      const typedKoota = koota as keyof CompatibilityBreakdown;
                                      const max = KOOTA_MAX[typedKoota] ?? 0;
                                      const value = max ? (score / max) * 100 : 0;
                                      return (
                                        <div key={koota} className="space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium">{koota}</span>
                                            <span className="text-muted-foreground">
                                              {score} / {max} Gunas
                                            </span>
                                          </div>
                                          <Progress value={value} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>

                  {!compatibility[currentProfile.id] && (
                    <div className="px-6 pb-4">
                      <p className="text-xs text-muted-foreground italic">
                        Compatibility score isn&apos;t available yet. It appears once both of you have complete birth details and kundli data.
                      </p>
                    </div>
                  )}
                 </Card>

                <div className="flex justify-center gap-4 mt-8">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full w-16 h-16 p-0"
                    onClick={() => handleSwipe("pass")}
                  >
                    <X className="w-8 h-8 text-destructive" />
                  </Button>
                  <Button
                    size="lg"
                    className="rounded-full w-16 h-16 p-0"
                    onClick={() => handleSwipe("interest")}
                  >
                    <Heart className="w-8 h-8" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-display font-bold mb-2">
                  No more profiles
                </h2>
                <p className="text-muted-foreground">
                  Check back later for new matches!
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            {matches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => (
                  <Card key={match.id} className="overflow-hidden">
                    <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
                      {match.photos && match.photos.length > 0 ? (
                        <img
                          src={match.photos[0]}
                          alt={match.name}
                          className="w-full h-full object-cover"
                        />
                      ) : match.profile_photo_url ? (
                        <img
                          src={match.profile_photo_url}
                          alt={match.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-24 h-24 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-display font-bold mb-2">{match.name}</h3>
                      <div className="space-y-2 mb-4">
                        {match.profession && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            <span>{match.profession}</span>
                          </div>
                        )}
                        {match.city && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span>{match.city}</span>
                          </div>
                        )}
                        {match.phone_number && (
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <Phone className="w-4 h-4" />
                            <span>{match.phone_number}</span>
                          </div>
                        )}
                      </div>
                      {match.interests && match.interests.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {match.interests.map((interest, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-display font-bold mb-2">No matches yet</h2>
                <p className="text-muted-foreground">
                  Start swiping to find your perfect match!
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  {currentUser?.photos && currentUser.photos.length > 0 ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 border-4 border-primary/20">
                      <img
                        src={currentUser.photos[0]}
                        alt={currentUser.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : currentUser?.profile_photo_url ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 border-4 border-primary/20">
                      <img
                        src={currentUser.profile_photo_url}
                        alt={currentUser.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <User className="w-12 h-12 text-primary" />
                    </div>
                  )}
                  <h2 className="text-2xl font-display font-bold">{currentUser?.name}</h2>
                  <p className="text-muted-foreground capitalize">{currentUser?.gender}</p>
                </div>

                {currentUser && (
                  <div className="space-y-4 mb-6">
                    {currentUser.profession && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Profession</p>
                          <p className="font-semibold">{currentUser.profession}</p>
                        </div>
                      </div>
                    )}
                    {currentUser.phone_number && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone Number</p>
                          <p className="font-semibold">{currentUser.phone_number}</p>
                        </div>
                      </div>
                    )}
                    {currentUser.city && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">City</p>
                          <p className="font-semibold">{currentUser.city}</p>
                        </div>
                      </div>
                    )}
                    {currentUser.salary_range && (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Income Range</p>
                          <p className="font-semibold capitalize">
                            {currentUser.salary_range.replace(/-/g, " - ").replace("lakh", " Lakh")}
                          </p>
                        </div>
                      </div>
                    )}
                    {currentUser.interests && currentUser.interests.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Interests</p>
                        <div className="flex flex-wrap gap-2">
                          {currentUser.interests.map((interest, idx) => (
                            <Badge key={idx} variant="secondary">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {currentUser.photos && currentUser.photos.length > 1 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">All Photos</p>
                        <div className="grid grid-cols-3 gap-2">
                          {currentUser.photos.map((photo, idx) => (
                            <div key={idx} className="aspect-square rounded-lg overflow-hidden border">
                              <img
                                src={photo}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {kundliData && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Your Kundli
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Sun Sign</p>
                        <p className="font-semibold">{kundliData.kundli_json.sun_sign || "N/A"}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Moon Sign</p>
                        <p className="font-semibold">{kundliData.kundli_json.moon_sign || "N/A"}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Ascendant</p>
                        <p className="font-semibold">{kundliData.kundli_json.ascendant || "N/A"}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Nakshatra</p>
                        <p className="font-semibold">{kundliData.kundli_json.nakshatra || "N/A"}</p>
                      </div>
                    </div>

                    {kundliData.kundli_json.life_aspects && (
                      <div className="space-y-3 mt-6">
                        <h4 className="font-semibold">Life Aspects</h4>
                        {Object.entries(kundliData.kundli_json.life_aspects).map(([key, value]: [string, any]) => (
                          <div key={key} className="bg-secondary/50 rounded-lg p-4">
                            <p className="text-sm font-semibold capitalize mb-1">{key}</p>
                            <p className="text-sm text-muted-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
