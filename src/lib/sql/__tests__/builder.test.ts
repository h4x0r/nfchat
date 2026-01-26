import { describe, it, expect } from 'vitest';
import { WhereClauseBuilder } from '../builder';

describe('WhereClauseBuilder', () => {
  describe('addInClause', () => {
    it('creates IN clause for string values', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('column', ['a', 'b', 'c']);

      expect(builder.build()).toBe("column IN ('a', 'b', 'c')");
    });

    it('creates IN clause for number values', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('port', [80, 443, 8080]);

      expect(builder.build()).toBe('port IN (80, 443, 8080)');
    });

    it('escapes single quotes in strings', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('name', ["O'Brien", "it's"]);

      expect(builder.build()).toBe("name IN ('O''Brien', 'it''s')");
    });

    it('handles empty array gracefully', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('column', []);

      expect(builder.build()).toBe('1=1');
    });

    it('supports chaining', () => {
      const builder = new WhereClauseBuilder()
        .addInClause('src', ['10.0.0.1'])
        .addInClause('dst', ['10.0.0.2']);

      expect(builder.build()).toBe("src IN ('10.0.0.1') AND dst IN ('10.0.0.2')");
    });
  });

  describe('addRange', () => {
    it('adds min condition when min provided', () => {
      const builder = new WhereClauseBuilder();
      builder.addRange('timestamp', 1000, undefined);

      expect(builder.build()).toBe('timestamp >= 1000');
    });

    it('adds max condition when max provided', () => {
      const builder = new WhereClauseBuilder();
      builder.addRange('timestamp', undefined, 2000);

      expect(builder.build()).toBe('timestamp <= 2000');
    });

    it('adds both conditions when both provided', () => {
      const builder = new WhereClauseBuilder();
      builder.addRange('timestamp', 1000, 2000);

      expect(builder.build()).toBe('timestamp >= 1000 AND timestamp <= 2000');
    });

    it('handles null values same as undefined', () => {
      const builder = new WhereClauseBuilder();
      builder.addRange('timestamp', null, null);

      expect(builder.build()).toBe('1=1');
    });
  });

  describe('addLike', () => {
    it('creates LIKE clause with wildcards', () => {
      const builder = new WhereClauseBuilder();
      builder.addLike('column', 'test');

      expect(builder.build()).toBe("column LIKE '%test%'");
    });

    it('escapes special LIKE characters', () => {
      const builder = new WhereClauseBuilder();
      builder.addLike('column', '50%_test');

      expect(builder.build()).toBe("column LIKE '%50\\%\\_test%'");
    });

    it('handles empty string gracefully', () => {
      const builder = new WhereClauseBuilder();
      builder.addLike('column', '');

      expect(builder.build()).toBe('1=1');
    });
  });

  describe('addCondition', () => {
    it('adds validated condition', () => {
      const builder = new WhereClauseBuilder();
      builder.addCondition('column', '=', 'value');

      expect(builder.build()).toBe("column = 'value'");
    });

    it('supports numeric values', () => {
      const builder = new WhereClauseBuilder();
      builder.addCondition('port', '=', 80);

      expect(builder.build()).toBe('port = 80');
    });

    it('rejects invalid operators', () => {
      const builder = new WhereClauseBuilder();
      expect(() => builder.addCondition('column', 'DROP', 'value')).toThrow(
        /Invalid operator/
      );
    });
  });

  describe('addCustom', () => {
    it('adds validated custom condition', () => {
      const builder = new WhereClauseBuilder();
      builder.addCustom('column1 > 0');

      expect(builder.build()).toBe('(column1 > 0)');
    });

    it('wraps condition in parentheses for safety', () => {
      const builder = new WhereClauseBuilder();
      builder.addCustom('a = 1 OR b = 2');

      expect(builder.build()).toBe('(a = 1 OR b = 2)');
    });

    it('rejects conditions with dangerous patterns', () => {
      const builder = new WhereClauseBuilder();

      // Test SQL injection patterns
      expect(() => builder.addCustom("1; DROP TABLE users; --")).toThrow();
      expect(() => builder.addCustom("1'; DROP TABLE users; --")).toThrow();
      expect(() => builder.addCustom("UNION SELECT * FROM users")).toThrow();
    });

    it('rejects conditions with dangerous keywords', () => {
      const builder = new WhereClauseBuilder();

      expect(() => builder.addCustom('DROP TABLE users')).toThrow();
      expect(() => builder.addCustom('DELETE FROM users')).toThrow();
      expect(() => builder.addCustom('INSERT INTO users')).toThrow();
      expect(() => builder.addCustom('UPDATE users SET')).toThrow();
    });

    it('allows safe SQL constructs', () => {
      const builder = new WhereClauseBuilder();

      // These should all be allowed
      builder.addCustom('column > 100');
      builder.addCustom('column BETWEEN 1 AND 10');
      builder.addCustom('column IS NOT NULL');

      expect(builder.build()).toContain('column > 100');
    });
  });

  describe('build', () => {
    it('joins multiple conditions with AND', () => {
      const builder = new WhereClauseBuilder()
        .addInClause('src', ['10.0.0.1'])
        .addRange('timestamp', 1000, 2000)
        .addLike('attack', 'DoS');

      const result = builder.build();
      expect(result).toContain("src IN ('10.0.0.1')");
      expect(result).toContain('timestamp >= 1000');
      expect(result).toContain('timestamp <= 2000');
      expect(result).toContain("attack LIKE '%DoS%'");
      expect(result.split(' AND ').length).toBeGreaterThanOrEqual(3);
    });

    it('returns 1=1 when no conditions added', () => {
      const builder = new WhereClauseBuilder();

      expect(builder.build()).toBe('1=1');
    });

    it('can build multiple times without side effects', () => {
      const builder = new WhereClauseBuilder().addInClause('col', ['a']);

      const result1 = builder.build();
      const result2 = builder.build();

      expect(result1).toBe(result2);
    });
  });

  describe('SQL injection prevention', () => {
    it('escapes injection attempts in string values', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('column', ["'; DROP TABLE users; --"]);

      const result = builder.build();
      // The single quote is doubled to '' which escapes it
      // The result is: column IN ('''; DROP TABLE users; --')
      // When parsed: the string literal contains: '; DROP TABLE users; --
      // NOT executable SQL because the quote is escaped
      expect(result).toBe("column IN ('''; DROP TABLE users; --')");

      // Verify the quote was doubled (key security check)
      expect(result).toContain("('''");  // Opening: single quote, then escaped quote
    });

    it('handles numeric strings as strings not injections', () => {
      const builder = new WhereClauseBuilder();
      builder.addInClause('column', ['1 OR 1=1']);

      const result = builder.build();
      expect(result).toBe("column IN ('1 OR 1=1')");
    });
  });
});
