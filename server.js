import dotenv from "dotenv";
import Fastify from "fastify";
import axios from "axios";

const fastify = Fastify({ logger: false });

dotenv.config();

const LEETCODE_API = "https://leetcode.com/graphql/";
const username = process.env.USERNAME || "";
const cookies = process.env.COOKIES || "";

console.log("!!process.env", process.env);

async function fetchLeetCodeData() {
  const queries = [
    {
      query: `query userProfileCalendar($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            submissionCalendar
          }
        }
      }`,
      variables: { username },
    },
    {
      query: `query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }`,
      variables: { username },
    },
  ];

  const results = await Promise.all(
    queries.map((q) =>
      axios
        .post(LEETCODE_API, q, {
          headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
          },
        })
        .then((res) => {
          console.log("Query Response:", JSON.stringify(res.data, null, 2));
          return res.data.data;
        })
        .catch((err) => {
          console.error("GraphQL Error:", err.response?.data || err.message);
          throw err;
        })
    )
  );

  return {
    calendar: results[0].matchedUser.userCalendar,
    stats: results[1].matchedUser.submitStatsGlobal.acSubmissionNum,
  };
}

async function generateWidget(data) {
  // Calculate 52 weeks (364 days) from today
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const endTimestamp = Math.floor(today.getTime() / 1000);
  const startTimestamp = Math.floor((today - 364 * oneDay) / 1000);

  // Adjust start to first Sunday
  const startDate = new Date(startTimestamp * 1000);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const adjustedStartTimestamp = Math.floor(startDate.getTime() / 1000);

  // Parse submissionCalendar (full history)
  const calendar = JSON.parse(data.calendar.submissionCalendar);

  // Map activity for 364 days within the last year
  const activity = Array(364).fill(0);
  let activeDays = 0;
  for (const timestamp in calendar) {
    const ts = parseInt(timestamp);
    const daysFromStart = Math.floor((ts - adjustedStartTimestamp) / 86400);
    if (daysFromStart >= 0 && daysFromStart < 364) {
      activity[daysFromStart] = calendar[timestamp];
      activeDays++;
    }
  }
  console.log("Adjusted Start Timestamp:", adjustedStartTimestamp);
  console.log("End Timestamp:", endTimestamp);
  console.log("Active Days in Last 364:", activeDays);
  console.log("Sample Activity (first 10):", activity.slice(0, 10));
  console.log("Sample Activity (last 10):", activity.slice(-10));

  // Heatmap: 7x52 grid
  const width = 720;
  const height = 165;
  const cellSize = 11;
  const spacing = 2;
  let heatmapSvg = "";
  const maxCount = Math.max(...activity, 1);

  for (let i = 0; i < 364; i++) {
    const count = activity[i];
    const day = i % 7; // 0-6 (Sun-Sat)
    const week = Math.floor(i / 7); // 0-51
    const x = week * (cellSize + spacing) + 20;
    const y = day * (cellSize + spacing) + 20;
    const intensity = count === 0 ? 0 : Math.min(count / maxCount, 1);
    const fill =
      count === 0 ? "#ebedf0" : `rgba(0, 200, 0, ${intensity * 0.8 + 0.2})`;
    heatmapSvg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" rx="2" />`;
  }

  // Solved Stats
  const solved = data.stats.reduce((acc, curr) => acc + curr.count, 0);
  const easy = data.stats.find((s) => s.difficulty === "Easy")?.count || 0;
  const medium = data.stats.find((s) => s.difficulty === "Medium")?.count || 0;
  const hard = data.stats.find((s) => s.difficulty === "Hard")?.count || 0;

  // SVG Card
  const svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" rx="10" stroke="#d3d3d3" stroke-width="1"/>
      <text x="20" y="15" font-family="Arial" font-size="14" fill="#333">LeetCode Stats: ${username}</text>
      ${heatmapSvg}
      <text x="20" y="${
        height - 40
      }" font-family="Arial" font-size="12" fill="#333">Solved: ${solved}</text>
      <text x="20" y="${
        height - 25
      }" font-family="Arial" font-size="12" fill="#333">Easy: ${easy} | Medium: ${medium} | Hard: ${hard}</text>
    </svg>
  `.trim();

  return svgContent;
}

fastify.get("/widget", async (request, reply) => {
  const svgContent = await generateWidget(await fetchLeetCodeData());
  reply.type("image/svg+xml").send(svgContent);
});

export async function handler(event) {
  const svgContent = await generateWidget(await fetchLeetCodeData());
  return {
    statusCode: 200,
    headers: { "Content-Type": "image/svg+xml" },
    body: svgContent,
  };
}

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log("Server running on http://localhost:3000");
});
