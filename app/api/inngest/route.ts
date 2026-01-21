import { inngest } from "@/lib/ingest/client";
import { sendSignUpEmail } from "@/lib/ingest/functions";
import {serve} from "inngest/next";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail],
});