import { Router } from "express";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"];

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@1234baseball.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

interface PushBody {
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  };
  title: string;
  body: string;
}

const pushRouter = Router();

pushRouter.post("/push/send", async (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }

  const { subscription, title, body } = req.body as PushBody;

  if (!subscription?.endpoint) {
    res.status(400).json({ error: "Missing or invalid subscription" });
    return;
  }

  try {
    await webpush.sendNotification(
      subscription as Parameters<typeof webpush.sendNotification>[0],
      JSON.stringify({ title, body }),
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "Failed to send push notification");
    res.status(500).json({ error: "Failed to send push notification" });
  }
});

export default pushRouter;
