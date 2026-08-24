import { Router } from "express";
import {
  customPricesDelete,
  customPricesGet,
  customPricesPatch,
  customPricesPost,
  customPricesUnpricedGet,
} from "./pricing.controller";

export const pricingRouter = Router();

pricingRouter.get("/custom-pricing", customPricesGet);
pricingRouter.get("/custom-pricing/unpriced", customPricesUnpricedGet);
pricingRouter.post("/custom-pricing", customPricesPost);
pricingRouter.patch("/custom-pricing/:id", customPricesPatch);
pricingRouter.delete("/custom-pricing/:id", customPricesDelete);
