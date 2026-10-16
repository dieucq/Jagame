// Mapper bổ sung cho jsnes (chỉ ở bản chạy thử cục bộ này, KHÔNG sửa node_modules).
// 202 = BMC 150-in-1, 227 = BMC 1200-in-1 (theo https://www.nesdev.org/wiki/INES_Mapper_202 / _227).
import Mapper0 from '../node_modules/jsnes/src/mappers/mapper0.js';

class Mapper202 extends Mapper0 {
  static mapperName = 'BMC 150-in-1';
  constructor(nes) { super(nes); this.latch = 0; }
  write(address, value) {
    if (address < 0x8000) { super.write(address, value); return; }
    this.latch = address & 0xffff;   // thanh ghi nằm ở ĐỊA CHỈ ghi, không phải dữ liệu
    this.sync();
  }
  sync() {
    const a = this.latch, r = (a >> 1) & 7, rom = this.nes.rom;
    if ((a & 9) === 9) {             // chế độ 32K
      this.loadRomBank(r & 6, 0x8000); this.loadRomBank(r | 1, 0xc000);
    } else {                         // 16K lặp ở cả hai nửa
      this.loadRomBank(r, 0x8000); this.loadRomBank(r, 0xc000);
    }
    this.load8kVromBank(r * 2, 0x0000);
    this.nes.ppu.setMirroring((a & 1) ? rom.HORIZONTAL_MIRRORING : rom.VERTICAL_MIRRORING);
  }
  loadROM() {
    if (!this.nes.rom.valid) throw new Error('Mapper 202: ROM không hợp lệ');
    this.latch = 0; this.sync();
    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
  }
  toJSON() { const s = super.toJSON(); s.latch = this.latch; return s; }
  fromJSON(s) { super.fromJSON(s); this.latch = s.latch | 0; }
}

class Mapper227 extends Mapper0 {
  static mapperName = 'BMC 1200-in-1';
  constructor(nes) { super(nes); this.latch = 0; }
  write(address, value) {
    if (address < 0x8000) { super.write(address, value); return; }
    this.latch = address & 0xffff;
    this.sync();
  }
  sync() {
    const a = this.latch, rom = this.nes.rom;
    const S = a & 1, M = (a >> 1) & 1, O = (a >> 7) & 1, L = (a >> 9) & 1;
    const p = ((a >> 2) & 0x1f) | ((a & 0x100) >> 3);   // PRG A19..A14
    if (O) {
      if (S) { this.loadRomBank(p & ~1, 0x8000); this.loadRomBank(p | 1, 0xc000); }   // NROM-256
      else { this.loadRomBank(p, 0x8000); this.loadRomBank(p, 0xc000); }              // NROM-128
    } else {
      this.loadRomBank(p, 0x8000);
      this.loadRomBank(L ? (p | 7) : (p & 0x38), 0xc000);                             // UNROM-like
    }
    this.nes.ppu.setMirroring(M ? rom.HORIZONTAL_MIRRORING : rom.VERTICAL_MIRRORING);
  }
  // CHR-RAM bị khóa ghi khi O=1 (đa-cart không pin)
  canWriteChr() { return this.nes.rom.vromCount === 0 && !((this.latch >> 7) & 1) ; }
  loadROM() {
    if (!this.nes.rom.valid) throw new Error('Mapper 227: ROM không hợp lệ');
    this.latch = 0; this.sync();
    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
  }
  toJSON() { const s = super.toJSON(); s.latch = this.latch; return s; }
  fromJSON(s) { super.fromJSON(s); this.latch = s.latch | 0; }
}

export function registerExtraMappers(Mappers) { Mappers[202] = Mapper202; Mappers[227] = Mapper227; }
