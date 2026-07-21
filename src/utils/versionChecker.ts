export class VersionChecker {
  /**
   * Compare two semantic version strings (e.g., "1.0.1" and "1.0.0").
   * Returns:
   * - 1 if v1 > v2
   * - -1 if v1 < v2
   * - 0 if v1 === v2
   */
  public static compare(v1: string, v2: string): number {
    const parts1 = v1.trim().split('.').map(Number);
    const parts2 = v2.trim().split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p2 > p1) return -1;
    }
    return 0;
  }

  /**
   * Returns true if latest version is newer than current version.
   */
  public static isNewer(current: string, latest: string): boolean {
    return this.compare(latest, current) > 0;
  }
}
