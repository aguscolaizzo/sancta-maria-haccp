import { supportsWebSerialPrinter } from "./printer-transport";
import { SupvanT50MProAdapter } from "./supvan-t50m-pro-adapter";

export const supportsT50DirectPrint = supportsWebSerialPrinter;
export class T50MPrinter extends SupvanT50MProAdapter {}
