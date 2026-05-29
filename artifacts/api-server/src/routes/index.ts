import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pushRouter from "./push";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pushRouter);
router.use(stripeRouter);

export default router;
