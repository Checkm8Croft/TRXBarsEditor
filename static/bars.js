import { BarsApp } from "./bars/app.js";

const app = new BarsApp({
  storageKey: "trx.tools.uiBars.state.v2",
  fileStorageKey: "trx.tools.uiBars.uiJson5.v1",
  barColorSteps: 5,
});

app.init();
