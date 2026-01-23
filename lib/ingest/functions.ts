import { inngest } from "./client";

import {
  NEWS_SUMMARY_EMAIL_PROMPT,
  PERSONALIZED_WELCOME_EMAIL_PROMPT,
} from "./prompts";

import {
  sendNewsSummaryEmail,
  sendWelcomeEmail,
} from "../nodemailer";

import { getAllUsersForNewsEmail } from "../actions/user.actions";
import { getWatchlistSymbolsByEmail } from "../actions/watchlist.actions";
import { getNews } from "../actions/finnhub.actions";
import { getFormattedTodayDate } from "../utils";

// TEMP types if you don’t have them yet
type UserForNewsEmail = {
  email: string;
  name?: string;
};

type MarketNewsArticle = any;

export const sendSignUpEmail = inngest.createFunction(
  { id: "sign-up-email" },
  { event: "app.user.created" },
  async ({ event, step }) => {
    const userProfile = `
      - Country: ${event.data.country}
      - Investment goals: ${event.data.investmentGoals}
      - Risk tolerance: ${event.data.riskTolerance}
      - Preferred industry: ${event.data.preferredIndustry}
    `;

    const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace(
      "{{userProfile}}",
      userProfile
    );

    const response = await step.ai.infer("generate-welcome-intro", {
      model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
    });

    await step.run("send-welcome-email", async () => {
      const part = response.candidates?.[0]?.content?.parts?.[0];
      const introText =
        (part && "text" in part ? part.text : null) ||
        "Thanks for joining Signalist. You now have the tools to track markets and make smarter moves.";

      const { email, name } = event.data;

      return sendWelcomeEmail({ email, name, intro: introText });
    });

    return { success: true, message: "Welcome email sent successfully" };
  }
);

export const sendDailyNewsSummary = inngest.createFunction(
  { id: "daily-news-summary" },
  [{ event: "app.send.daily.news" }, { cron: "0 12 * * *" }],
  async ({ step }) => {
    const users = await step.run(
      "get-all-users",
      getAllUsersForNewsEmail
    );

    if (!users || users.length === 0) {
      return { success: false, message: "No users found" };
    }

    const results = await step.run("fetch-user-news", async () => {
      const perUser: Array<{
        user: UserForNewsEmail;
        articles: MarketNewsArticle[];
      }> = [];

      for (const user of users) {
        try {
          const symbols = await getWatchlistSymbolsByEmail(user.email);
          let articles = await getNews(symbols);

          articles = (articles || []).slice(0, 6);

          if (!articles.length) {
            articles = (await getNews()).slice(0, 6);
          }

          perUser.push({ user, articles });
        } catch (e) {
          console.error("daily-news error:", user.email, e);
          perUser.push({ user, articles: [] });
        }
      }

      return perUser;
    });

    const userNewsSummaries: {
      user: UserForNewsEmail;
      newsContent: string | null;
    }[] = [];

    for (const { user, articles } of results) {
      try {
        const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace(
          "{{newsData}}",
          JSON.stringify(articles, null, 2)
        );

        const response = await step.ai.infer(
          `summarize-news-${user.email}`,
          {
            model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
            body: {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            },
          }
        );

        const part = response.candidates?.[0]?.content?.parts?.[0];
        const newsContent =
          (part && "text" in part ? part.text : null) || "No market news.";

        userNewsSummaries.push({ user, newsContent });
      } catch (e) {
        console.error("Failed to summarize news for:", user.email);
        userNewsSummaries.push({ user, newsContent: null });
      }
    }

    await step.run("send-news-emails", async () => {
      await Promise.all(
        userNewsSummaries.map(({ user, newsContent }) => {
          if (!newsContent) return null;
          return sendNewsSummaryEmail({
            email: user.email,
            date: getFormattedTodayDate(),
            newsContent,
          });
        })
      );
    });

    return {
      success: true,
      message: "Daily news summary emails sent successfully",
    };
  }
);
