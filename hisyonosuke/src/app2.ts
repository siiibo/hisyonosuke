// index.tsのような書き振りにするか?
import { doPost } from "./shift-changer/shift-changer";

declare const global: any;
global.doPost = doPost;
