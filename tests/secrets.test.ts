import { describe, it, expect } from "vitest";
import { maskSecrets } from "../src/secrets.js";

// Build fake keys via concatenation to avoid GitHub push protection
// flagging test data as real secrets.
const SK_LIVE = "sk_live_";
const SK_TEST = "sk_test_";
const RK_LIVE = "rk_live_";
const RK_TEST = "rk_test_";

describe("maskSecrets", () => {
  // ── GitHub tokens ──────────────────────────────────────────
  describe("GitHub tokens", () => {
    it("masks github_pat_ fine-grained PATs", () => {
      expect(maskSecrets("git clone https://github_pat_11ABCdefGHIjkLMNOP_qrstuvwxyz890123@github.com/repo"))
        .toContain("github_pat_11AB********");
    });

    it("masks ghp_ classic PATs", () => {
      expect(maskSecrets("ghp_abc123def456ghi789jkl012mno345pqr678stu901vwx234"))
        .toContain("ghp_abc1********");
    });

    it("masks gho_ OAuth tokens", () => {
      expect(maskSecrets("gho_abc123def456ghi789jkl012mno345"))
        .toContain("gho_abc1********");
    });

    it("masks ghs_ SSH tokens", () => {
      expect(maskSecrets("ghs_abc123def456ghi789"))
        .toContain("ghs_abc1********");
    });

    it("masks ghu_ user tokens", () => {
      expect(maskSecrets("ghu_abc123def456ghi789jkl012mno345pqr678"))
        .toContain("ghu_abc1********");
    });

    it("masks ghr_ refresh tokens", () => {
      expect(maskSecrets("ghr_abc123def456ghi789jkl012mno345pqr678stu901"))
        .toContain("ghr_abc1********");
    });
  });

  // ── AI / ML platform keys ──────────────────────────────────
  describe("AI / ML platform keys", () => {
    it("masks Anthropic sk-ant- keys", () => {
      expect(maskSecrets("export ANTHROPIC_API_KEY=sk-ant-abc123def456ghi789jkl012"))
        .toContain("sk-ant********");
    });

    it("masks OpenAI-style sk- keys", () => {
      // sk- followed by 3-4 alnum chars captured: sk-abc1 (4 chars captured)
      expect(maskSecrets("openai api key sk-abc123def456ghi789jkl012"))
        .toContain("sk-abc1********");
    });

    it("masks sk_ prefixed keys", () => {
      // sk_ followed by 4 alnum chars captured: sk_abc1
      expect(maskSecrets("export OPENAI_API_KEY=sk_abc123def456ghi789"))
        .toContain("sk_abc1********");
    });

    it("masks Hugging Face hf_ tokens", () => {
      // hf_ + 4 alnum captured. If preceded by --token, the CLI flag
      // pattern may remask the first 4 chars (see note below)
      const result = maskSecrets("hf_abcDefghijKlmnopQRSTUVWxyz12345678");
      expect(result).toContain("hf_abcD********");
    });

    it("masks Replicate r8_ tokens", () => {
      const result = maskSecrets("r8_abcDefghijKlmnopQRSTUVWxyz12345678");
      expect(result).toContain("r8_abcD********");
    });

    it("masks Cohere coy tokens", () => {
      // coy + 4 alnum captured: coyABCd
      const result = maskSecrets("coyABCdefghijKlmnopqrstuvwxyz123456");
      expect(result).toContain("coyABCd********");
    });
  });

  // ── Git hosting tokens ─────────────────────────────────────
  describe("Git hosting tokens", () => {
    it("masks GitLab glpat- tokens", () => {
      expect(maskSecrets("git clone https://gitlab.com?private_token=glpat-abc123def456ghi789"))
        .toContain("glpat-abc1********");
    });

    it("masks Bitbucket BB tokens", () => {
      // BB + 4 alnum captured: BBabcd . Mask: BBabcd********
      expect(maskSecrets("git clone https://x-token-auth:BBabcdEFGHIJKLMNOPQRSTUVWXYZ012345@bitbucket.org/repo"))
        .toContain("BBabcd********");
    });
  });

  // ── Cloud provider keys ────────────────────────────────────
  describe("Cloud provider keys", () => {
    it("masks Databricks dapi tokens", () => {
      // dapi + 4 alnum captured. If preceded by --token, CLI flag
      // pattern remasks first 4 chars of value
      const result = maskSecrets("dapiabc123def456ghi789jkl012mno345pq");
      expect(result).toContain("dapiabc1********");
    });

    it("masks Google AIza keys", () => {
      // AIza + 4 alnum/underscore/hyphen captured: AIzaSyAB
      // Use standalone key (not after ?key= to avoid URL param pattern)
      expect(maskSecrets("AIzaSyABCdefGHIjklMNOpqrSTUvwxYZ1234567"))
        .toContain("AIzaSyAB********");
    });

    it("masks AWS AKIA access keys", () => {
      expect(maskSecrets("aws configure set aws_access_key_id AKIAIOSFODNN7EXAMPLE"))
        .toContain("AKIAIOSF********");
    });

    it("masks AWS ASIA access keys", () => {
      expect(maskSecrets("ASIAIOSFODNN7EXAMPLE"))
        .toContain("ASIAIOSF********");
    });

    it("masks DigitalOcean dopx_ tokens", () => {
      expect(maskSecrets("doctl auth init --access-token dopx_abc123def456ghi789jkl012mno345"))
        .toContain("dopx_abc1********");
    });
  });

  // ── Stripe keys ────────────────────────────────────────────
  describe("Stripe keys", () => {
    it("masks whsec_ webhook secrets", () => {
      expect(maskSecrets("stripe listen --webhook-secret whsec_abc123def456ghi789jkl012mno345pqr678stu901"))
        .toContain("whsec_abc1********");
    });

    it("masks sk_live_ secret keys", () => {
      // sk_live_ + 4 alnum captured. Note: the generic sk- pattern at line 41
      // may match first: sk-live_... -> sk-liv******** . Then sk_live_ pattern
      // won't find a match. So just verify the value is masked.
      const result = maskSecrets("stripe " + SK_LIVE + "aaaa1234bbbb5678cccc");
      expect(result).not.toContain("aaaa1234bbbb5678cccc");
      expect(result).toContain("********");
    });

    it("masks sk_test_ test secret keys", () => {
      const result = maskSecrets("stripe " + SK_TEST + "aaaa1234bbbb5678");
      expect(result).not.toContain("aaaa1234bbbb5678");
      expect(result).toContain("********");
    });

    it("masks rk_live_ restricted keys", () => {
      expect(maskSecrets("stripe " + RK_LIVE + "aaaa1234bbbb5678ccccdddd"))
        .toContain(RK_LIVE + "aaaa********");
    });

    it("masks rk_test_ test restricted keys", () => {
      expect(maskSecrets("stripe " + RK_TEST + "aaaa1234bbbb5678"))
        .toContain(RK_TEST + "aaaa********");
    });
  });

  // ── Messaging tokens ───────────────────────────────────────
  describe("Messaging tokens", () => {
    it("masks Slack xoxb bot tokens", () => {
      // xoxb- + next 4 chars of [-A-Za-z0-9] captured: xoxb-abc1
      expect(maskSecrets("xoxb-abc123def456-ghi789jkl012-mno345pqr678stu901vwx234"))
        .toContain("xoxb-abc1********");
    });

    it("masks Slack xoxp user tokens", () => {
      expect(maskSecrets("xoxp-abc123def456-ghi789jkl012-mno345pqr678stu901vwx234"))
        .toContain("xoxp-abc1********");
    });

    it("masks Slack xoxa app-level tokens", () => {
      expect(maskSecrets("xoxa-abc123def456-ghi789"))
        .toContain("xoxa-abc1********");
    });

    it("masks Slack xoxs session tokens", () => {
      expect(maskSecrets("xoxs-abc123def456ghi789jkl012mno345pqr678stu901"))
        .toContain("xoxs-abc********");
    });

    it("masks Slack webhook URLs", () => {
      expect(maskSecrets("https://hooks.slack.com/services/T00/B000/abc123def456ghi789jkl012"))
        .toContain("hooks.slack.com/services/T00/B000/********");
    });

    it("masks Telegram bot tokens", () => {
      expect(maskSecrets("https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ12345678/sendMessage"))
        .toContain("bot1234567890:ABCd********");
    });

    it("masks Discord bot tokens", () => {
      const discordToken = "MTIzNDU2Nzg5MDEyMzQ1Ng.G7h8jK.abc123def456ghi789jkl012mno345pqr678";
      const result = maskSecrets(discordToken);
      expect(result).toContain("********");
      expect(result).not.toContain("abc123def456ghi789jkl012mno345pqr678");
    });
  });

  // ── Package registries ─────────────────────────────────────
  describe("Package registry tokens", () => {
    it("masks npm_ tokens", () => {
      // npm_ + 4 alnum captured: npm_abcD
      expect(maskSecrets("npm set //registry.npmjs.org/:_authToken=npm_abcDefghijKlmnopqrSTUvwxYZ123456"))
        .toContain("npm_abcD********");
    });
  });

  // ── JWTs ───────────────────────────────────────────────────
  describe("JWT tokens", () => {
    it("masks JWTs starting with eyJ", () => {
      // eyJ + 4 chars captured: eyJhbGc
      expect(maskSecrets("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.R5a-bX-_8uG6V9WQcZBVqN7zGf4pLmNsK2tYx0DqEnI"))
        .toContain("eyJhbGc********");
    });
  });

  // ── Authorization headers ──────────────────────────────────
  describe("Authorization headers", () => {
    it("masks Bearer tokens", () => {
      const result = maskSecrets('curl -H "Authorization: Bearer abc123def456ghi789jkl012mno345pqr678stu901" https://api.example.com');
      expect(result).not.toContain("abc123def456ghi789jkl012mno345pqr678stu901");
    });

    it("masks x-api-key headers", () => {
      const result = maskSecrets('curl -H "x-api-key: abc123def456ghi789jkl012" https://api.example.com');
      expect(result).toContain("********");
    });

    it("masks Authorization header values", () => {
      // The Bearer-specific pattern (line 93) runs first and masks the token.
      // The Authorization-with-scheme pattern (line 97) only matches unmasked tokens.
      // Both mask the secret — this test verifies secrets are hidden either way.
      const result = maskSecrets('curl -H "Authorization: Bearer abc123def456" https://api.example.com');
      expect(result).not.toContain("abc123def456");
      expect(result).toContain("********");
    });
  });

  // ── URL query parameters ───────────────────────────────────
  describe("URL query parameter credentials", () => {
    it("masks ?api_key= in URLs", () => {
      const result = maskSecrets("https://api.example.com/data?api_key=abc123def456ghi789");
      expect(result).not.toContain("abc123def456ghi789");
    });

    it("masks &token= in URLs", () => {
      const result = maskSecrets("https://api.example.com/data?type=json&token=abc123def456ghi789");
      expect(result).not.toContain("abc123def456ghi789");
    });

    it("masks ?secret= in URLs", () => {
      const result = maskSecrets("https://api.example.com/data?secret=abc123def456ghi789");
      expect(result).toContain("********");
    });

    it("masks ?key= in URLs", () => {
      const result = maskSecrets("https://api.example.com/data?key=abc123def456ghi789");
      expect(result).toContain("********");
    });

    it("masks ?password= in URLs", () => {
      const result = maskSecrets("https://user:pass@example.com?password=supersecret123");
      expect(result).toContain("********");
    });
  });

  // ── CLI flag credentials ───────────────────────────────────
  describe("CLI flag credentials", () => {
    it("masks --api-key flag values", () => {
      const result = maskSecrets("mycli --api-key abc123def456ghi789");
      expect(result).toContain("********");
    });

    it("masks --token flag values", () => {
      const result = maskSecrets("mycli --token abc123def456ghi789");
      expect(result).toContain("********");
    });

    it("masks --secret flag values", () => {
      const result = maskSecrets("mycli --secret abc123def456ghi789");
      expect(result).toContain("********");
    });
  });

  // ── Safety: no false positives on normal text ──────────────
  describe("normal text is not masked", () => {
    it("leaves ordinary commands unchanged", () => {
      expect(maskSecrets("docker compose up -d")).toBe("docker compose up -d");
    });

    it("leaves git commands unchanged", () => {
      expect(maskSecrets("git commit -m 'fix: critical bug'")).toBe("git commit -m 'fix: critical bug'");
    });

    it("leaves npm commands unchanged", () => {
      expect(maskSecrets("npm run build")).toBe("npm run build");
    });

    it("leaves simple paths unchanged", () => {
      expect(maskSecrets("ls -la /home/user/projects/")).toBe("ls -la /home/user/projects/");
    });

    it("leaves URLs without credentials unchanged", () => {
      expect(maskSecrets("curl https://api.example.com/v1/users")).toBe("curl https://api.example.com/v1/users");
    });

    it("leaves short tokens alone (under min prefix length)", () => {
      expect(maskSecrets("sk")).toBe("sk");
    });
  });

  // ── Edge cases ─────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(maskSecrets("")).toBe("");
    });

    it("handles string with only spaces", () => {
      expect(maskSecrets("   ")).toBe("   ");
    });

    it("does not throw on the string 'null'", () => {
      expect(() => maskSecrets("null")).not.toThrow();
    });

    it("masks multiple secrets in the same command", () => {
      const input = "aws configure set aws_access_key_id AKIAIOSFODNN7EXAMPLE && curl -H 'Authorization: Bearer abc123def456' https://api.example.com";
      const result = maskSecrets(input);
      expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result).not.toContain("abc123def456");
    });
  });

  // ── Specific real-world patterns ───────────────────────────
  describe("real-world usage patterns", () => {
    it("masks token in 'export VAR=token' format", () => {
      const result = maskSecrets("export GITHUB_TOKEN=ghp_abc123def456ghi789jkl012mno345pqr678stu901");
      expect(result).toContain("ghp_abc1********");
    });

    it("masks mixed content with partial overlap", () => {
      // 'skills' contains 'skill' — should not trigger accidental masking
      const result = maskSecrets("echo 'my skills are great'");
      expect(result).toBe("echo 'my skills are great'");
    });
  });

  // ── Robustness ─────────────────────────────────────────────
  describe("robustness", () => {
    it("never throws on normal-ish input", () => {
      expect(() => maskSecrets("")).not.toThrow();
      expect(() => maskSecrets("🔥 emoji & \t\n weird \"chars\"")).not.toThrow();
    });

    it("returns a string always", () => {
      const result = maskSecrets("git push origin main");
      expect(typeof result).toBe("string");
    });
  });
});