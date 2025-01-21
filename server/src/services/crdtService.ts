import { PixelDataCRDT } from "../crdt/PixelDataCRDT";
import { State } from "../crdt/CRDTTypes";
import { getCurrentDateTimeString } from "./helpers";

class CRDTService {
  private static instance: CRDTService;
  private pixelData: PixelDataCRDT;

  constructor() {
    this.pixelData = new PixelDataCRDT(
      `ServerPixelData${getCurrentDateTimeString()}`
    );
  }

  static getInstance(): CRDTService {
    if (!CRDTService.instance) {
      CRDTService.instance = new CRDTService();
    }
    return CRDTService.instance;
  }

  getPixelData(): PixelDataCRDT {
    return this.pixelData;
  }

  getCurrentState(): State<[number, number, number]> {
    return this.pixelData.state;
  }

  setPixelData(pixelData: PixelDataCRDT) {
    this.pixelData = pixelData;
  }

  syncState(state: State<[number, number, number]>) {
    this.pixelData.merge(state);
    return this.pixelData.state;
  }
}

export const crdtService = new CRDTService();
