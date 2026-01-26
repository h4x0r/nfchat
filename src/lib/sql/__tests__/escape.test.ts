import { describe, it, expect } from 'vitest';
import { escapeString, escapeLikePattern, escapeIdentifier, isValidColumnName } from '../escape';

describe('SQL Escape Utilities', () => {
  describe('escapeString', () => {
    it('returns string unchanged when no special characters', () => {
      expect(escapeString('hello')).toBe('hello');
    });

    it('escapes single quotes by doubling them', () => {
      expect(escapeString("O'Brien")).toBe("O''Brien");
      expect(escapeString("it's")).toBe("it''s");
    });

    it('handles multiple single quotes', () => {
      expect(escapeString("it''s")).toBe("it''''s");
    });

    it('handles empty string', () => {
      expect(escapeString('')).toBe('');
    });

    it('escapes backslashes', () => {
      expect(escapeString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('handles mixed quotes and backslashes', () => {
      expect(escapeString("it's a\\path")).toBe("it''s a\\\\path");
    });
  });

  describe('escapeLikePattern', () => {
    it('escapes percent signs', () => {
      expect(escapeLikePattern('100%')).toBe('100\\%');
    });

    it('escapes underscores', () => {
      expect(escapeLikePattern('test_value')).toBe('test\\_value');
    });

    it('escapes single quotes', () => {
      expect(escapeLikePattern("O'Brien")).toBe("O''Brien");
    });

    it('escapes all special characters together', () => {
      expect(escapeLikePattern("50%_test'val")).toBe("50\\%\\_test''val");
    });
  });

  describe('escapeIdentifier', () => {
    it('wraps identifier in double quotes', () => {
      expect(escapeIdentifier('column')).toBe('"column"');
    });

    it('escapes embedded double quotes', () => {
      expect(escapeIdentifier('my"column')).toBe('"my""column"');
    });
  });

  describe('isValidColumnName', () => {
    it('returns true for simple column names', () => {
      expect(isValidColumnName('column')).toBe(true);
      expect(isValidColumnName('IPV4_SRC_ADDR')).toBe(true);
      expect(isValidColumnName('L4_SRC_PORT')).toBe(true);
    });

    it('returns false for names with SQL keywords', () => {
      expect(isValidColumnName('DROP TABLE')).toBe(false);
      expect(isValidColumnName('1; DROP')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidColumnName('')).toBe(false);
    });

    it('returns false for names with semicolons', () => {
      expect(isValidColumnName('col;DROP')).toBe(false);
    });

    it('returns false for names with parentheses', () => {
      expect(isValidColumnName('col()')).toBe(false);
    });

    it('returns true for allowed special characters', () => {
      expect(isValidColumnName('col_name')).toBe(true);
      expect(isValidColumnName('col123')).toBe(true);
    });
  });
});
