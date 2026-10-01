import { redirect } from "next/navigation";

// Campaigns are no longer a standalone section - each pre-built agent gets
// its own calling list automatically (see /agents/templates and
// activateAgentTemplateAction), reachable from that agent's own detail
// page. The underlying campaign data/routes (/campaigns/[id], /campaigns/new)
// are unchanged and still fully functional, just not linked from the main
// nav anymore.
export default function CampaignsIndexRedirect() {
  redirect("/agents");
}
