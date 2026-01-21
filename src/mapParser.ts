// TASKING Map File Parser

export interface MemoryRegion {
  name: string;
  code: number;
  data: number;
  reserved: number;
  free: number;
  total: number;
}

export interface Symbol {
  name: string;
  address: string;
  space: string;
  section?: string;
}

export interface Section {
  file: string;
  name: string;
  size: number;
  offset: number;
  outputSection: string;
}

export class TaskingMapParser {
  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  parseMemoryUsage(): MemoryRegion[] {
    const regions: MemoryRegion[] = [];
    const memorySection = this.extractSection('Memory usage in bytes');
    
    if (!memorySection) return regions;

    const regex = /\|\s+(\S+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|/g;
    
    let match;
    while ((match = regex.exec(memorySection)) !== null) {
      if (match[1] === 'Memory' || match[1] === 'Total') continue;
      
      regions.push({
        name: match[1],
        code: parseInt(match[2], 16),
        data: parseInt(match[3], 16),
        reserved: parseInt(match[4], 16),
        free: parseInt(match[5], 16),
        total: parseInt(match[6], 16)
      });
    }

    return regions;
  }

  parseSymbols(): Symbol[] {
    const symbols: Symbol[] = [];

    const text = this.content;

    const start = text.indexOf("* Symbols (sorted on name)");
    if (start < 0) return symbols;

    const end = text.indexOf("* Symbols (sorted on address)", start);
    const section = end >= 0 ? text.substring(start, end) : text.substring(start);

    const re = /^\|\s*([A-Za-z_]\w*)\s*\|\s*(0x[0-9A-Fa-f]+)\s*\|\s*([^|]*)\|/gm;

    const seen = new Set<string>();
    let m: RegExpExecArray | null;

    while ((m = re.exec(section)) !== null) {
        const name = m[1];
        const addr = m[2];
        const space = (m[3] ?? "").trim();

        if (name === "Name") continue;
        if (seen.has(name)) continue;
        seen.add(name);

        symbols.push({ name, address: addr, space });
    }

    return symbols;
  }


    public getSymbolAddress(name: string): string | undefined {
    const symbols = this.parseSymbols(); 
    const found = symbols.find(s => s.name === name);
    return found?.address;
  }

  parseSections(): Section[] {
    const sections: Section[] = [];
    const linkResultSection = this.extractSection('Link Result');
    
    if (!linkResultSection) return sections;

    const regex = /\|\s+(\S+)\s+\|\s+(.+?)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|\s+(.+?)\s+\|\s+(0x[0-9a-fA-F]+)\s+\|/g;
    
    let match;
    while ((match = regex.exec(linkResultSection)) !== null) {
      if (match[1] === '[in]') continue;
      
      sections.push({
        file: match[1],
        name: match[2].trim(),
        size: parseInt(match[3], 16),
        offset: parseInt(match[4], 16),
        outputSection: match[5].trim()
      });
    }

    return sections;
  }

  private extractSection(sectionTitle: string): string | null {
    const regex = new RegExp(
      `\\*+\\s+${sectionTitle}\\s+\\*+([\\s\\S]*?)(?=\\n\\*+|$)`,
      'i'
    );
    
    const match = this.content.match(regex);
    return match ? match[1] : null;
  }

  getTotalMemoryStats(): { used: number; total: number; percentage: number } {
    const regions = this.parseMemoryUsage();
    let totalUsed = 0;
    let totalMemory = 0;

    regions.forEach(region => {
      totalUsed += region.code + region.data + region.reserved;
      totalMemory += region.total;
    });

    return {
      used: totalUsed,
      total: totalMemory,
      percentage: totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0
    };
  }

  findSymbol(name: string): Symbol | undefined {
    const symbols = this.parseSymbols();
    return symbols.find(s => s.name === name);
  }

  getSymbolsInSection(sectionName: string): Symbol[] {
    return this.parseSymbols().filter(s => 
      s.section && s.section.includes(sectionName)
    );
  }
}
