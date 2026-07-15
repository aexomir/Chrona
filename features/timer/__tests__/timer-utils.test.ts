import { formatTime } from "../timer-utils";

describe("formatTime", () => {
  it("formats seconds under a minute as MM:SS", () => {
    expect(formatTime(45)).toBe("00:45");
  });

  it("formats minutes and seconds under an hour as MM:SS", () => {
    expect(formatTime(125)).toBe("02:05");
  });

  it("omits the hour segment entirely below 3600 seconds", () => {
    expect(formatTime(3599)).toBe("59:59");
  });

  it("formats an hour boundary as H:MM:SS", () => {
    expect(formatTime(3600)).toBe("1:00:00");
  });

  it("formats hours, minutes, and seconds together", () => {
    expect(formatTime(7325)).toBe("2:02:05");
  });

  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("00:00");
  });
});
