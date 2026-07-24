export class VersionChecker {
  /**
   * Cleans and normalizes a raw version string.
   * Strips leading 'v'/'V', trims whitespace.
   * Returns cleaned string or null if input is fundamentally invalid.
   */
  public static clean(version: any): string | null {
    if (version === null || version === undefined) {
      return null;
    }
    const str = String(version).trim();
    if (!str) {
      return null;
    }
    // Strip leading 'v' or 'V'
    const stripped = str.replace(/^[vV]/, '').trim();
    if (!stripped) {
      return null;
    }
    return stripped;
  }

  /**
   * Parses a version string into an array of non-negative numeric segment values.
   * Missing or invalid version strings return null and log a warning.
   */
  public static parse(version: any): number[] | null {
    const cleaned = this.clean(version);
    if (!cleaned) {
      console.warn(`[VersionChecker] Received empty or invalid version string: "${version}"`);
      return null;
    }

    const parts = cleaned.split('.');
    const numericParts: number[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      // Check if part is non-empty and consists entirely of digits
      if (!/^\d+$/.test(part)) {
        console.warn(`[VersionChecker] Invalid numeric segment "${part}" in version string: "${version}"`);
        return null;
      }
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        console.warn(`[VersionChecker] Segment conversion error for "${part}" in version string: "${version}"`);
        return null;
      }
      numericParts.push(num);
    }

    return numericParts;
  }

  /**
   * Validates whether a version string is a valid semantic version.
   */
  public static isValid(version: any): boolean {
    return this.parse(version) !== null;
  }

  /**
   * Compares two semantic version strings segment by segment.
   * Treats missing segments as zero.
   * 
   * Returns:
   * - 1 if v1 > v2
   * - -1 if v1 < v2
   * - 0 if v1 === v2
   */
  public static compare(v1: any, v2: any): number {
    const p1 = this.parse(v1);
    const p2 = this.parse(v2);

    // Handle invalid inputs gracefully without crashing
    if (!p1 && !p2) {
      console.error(`[VersionChecker] Both version strings are invalid: v1="${v1}", v2="${v2}"`);
      return 0;
    }
    if (!p1) {
      console.error(`[VersionChecker] Invalid v1 version string: "${v1}"`);
      return -1;
    }
    if (!p2) {
      console.error(`[VersionChecker] Invalid v2 version string: "${v2}"`);
      return 1;
    }

    const maxLength = Math.max(p1.length, p2.length);

    for (let i = 0; i < maxLength; i++) {
      const seg1 = i < p1.length ? p1[i] : 0;
      const seg2 = i < p2.length ? p2[i] : 0;

      if (seg1 > seg2) return 1;
      if (seg1 < seg2) return -1;
    }

    return 0;
  }

  /**
   * Returns true if latest version is newer than current version.
   */
  public static isNewer(current: any, latest: any): boolean {
    return this.compare(latest, current) > 0;
  }

  /**
   * Returns true if v1 is older than v2 (v1 < v2).
   */
  public static isOlder(v1: any, v2: any): boolean {
    return this.compare(v1, v2) < 0;
  }

  /**
   * Returns true if two versions are semantically equal.
   */
  public static isEqual(v1: any, v2: any): boolean {
    return this.compare(v1, v2) === 0;
  }

  /**
   * Formats a version string for display.
   * Returns "Unable to determine version" if invalid or unparseable.
   */
  public static formatDisplayVersion(version: any): string {
    const cleaned = this.clean(version);
    if (!cleaned || !this.isValid(version)) {
      return 'Unable to determine version';
    }
    return cleaned;
  }
}
