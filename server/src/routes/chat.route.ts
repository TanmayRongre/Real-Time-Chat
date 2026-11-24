import { Router } from "express";
import { getConversationMessages } from "../controllers/chat.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/:userId/messages", authenticate, getConversationMessages);

export default router;

