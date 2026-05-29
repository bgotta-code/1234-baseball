import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pushRouter from "./push";
import stripeRouter from "./stripe";
import licenseRouter from "./license";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pushRouter);
router.use(stripeRouter);
router.use(licenseRouter);

export default router;
