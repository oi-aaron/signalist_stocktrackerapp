import { inngest } from "@/lib/ingest/client";
import { sendDailyNewsSummary, sendSignUpEmail } from "@/lib/ingest/functions";
import {serve} from "inngest/next";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendDailyNewsSummary],
});