import { Link, useParams } from "react-router-dom";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function MobileTeamDetail() {
  const { eventId = "", teamId = "" } = useParams();
  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto">
      <Card className="p-6 text-center">
        <Video className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-bold">Ready to record?</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Make sure your phone is in landscape mode, the lighting is good, and you have a stable view of the entire performance area.
        </p>
        <Button asChild className="w-full h-12 text-base">
          <Link to={`/m/events/${eventId}/teams/${teamId}/record`}>Start recording</Link>
        </Button>
      </Card>
    </div>
  );
}
