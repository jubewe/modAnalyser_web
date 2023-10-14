const {
  log,
  isNullUndefined,
  ascii,
  regexEscape,
  convertToArray,
  returnErr,
} = require("oberknecht-utils");
const { request } = require("oberknecht-request");
const j = require("./variables/j");
const csvParse = require("csv-parse");
const fs = require("fs");

const delimiter = ",";
const seperator = '"';

let hasChanges = false;
let csvLinesRaw = [];
let csvLinesRawParsed = [];
(() => {
  if (!j.csvFilePath) return;
  fs.createReadStream(j.csvFilePath)
    .pipe(
      csvParse.parse({
        delimiter: delimiter,
        from_line: 1,
        encoding: "utf-8",
        autoParse: true,
      })
    )
    .on("data", (line) => {
      csvLinesRaw.push(line);
    })
    .on("finish", () => {
      // csvLinesRawParsed = csvLinesRaw.map((a) => ascii.toNumbers(a.toString()));
      parseLines();
      let questions = csvLinesRaw[0];
      let hasRatings = questions.at(-1) === "jRating";
      if (!hasRatings) {
        csvLinesRaw.forEach((a, i) => {
          a.push(i === 0 ? "jRating" : "");
        });
        hasChanges = true;
      }

      let ratingIndex = questions.length - 1;

      parseLines();

      function parseLines() {
        csvLinesRaw = csvLinesRaw;
      }

      function convertToBuffer(arr) {
        return arr.map((a) => Buffer.from(a.toString()).toString("base64"));
      }

      function saveCSV() {
        if (!hasChanges) return;
        let csvNew = csvLinesRaw
          .map((a) => {
            return a
              .map((b) => {
                return b.toString().includes(delimiter) ||
                  b.toString().includes("\n")
                  ? seperator +
                      b.replace(
                        new RegExp(regexEscape(seperator), "g"),
                        seperator.repeat(2)
                      ) +
                      seperator
                  : b;
              })
              .join(delimiter);
          })
          .join("\n");

        fs.writeFileSync(j.csvFilePath, csvNew, "utf-8");
      }

      setInterval(() => {
        saveCSV();
      }, 10000);

      (() => {
        j.express.listen(j.config.port, () => {
          log(1, `Express listening on port :${j.config.port}`);
        });

        j.express.use("/static", j.expressStatic);

        j.express.get("/", (req, res) => {
          let r = [
            `<!DOCTYPE html>`,
            `<html lang="en">`,
            `<head>`,
            `<meta charset="UTF-8">`,
            `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
            `<script src="/static/scripts/index.bundle.js"></script>`,
            `<link href="/static/styles/index.css" rel="stylesheet">`,
            `<title>Ju / Modapplication</title>`,
            `</head>`,
            `<body></body>`,
            `</html>`,
          ].join("\n");

          res.send(r);
        });
      })();

      (() => {
        j.wsServer.on("connection", async (ws) => {
          let wsData = {};
          ws.on("message", async (msgRaw) => {
            let msg = Buffer.from(msgRaw).toString("utf-8");
            let msgParsed = JSON.parse(msg);

            function sendWC(stuff, status) {
              let stuff_ = {};

              if (typeof stuff !== "object") stuff_.data = stuff;
              else stuff_ = { ...stuff };
              stuff_.status = status ?? 200;
              if (stuff instanceof Error || stuff.error) {
                stuff_.error = returnErr(stuff?.error ?? stuff);
                if (!stuff_.status) stuff_.status = 400;
              }
              if (!isNullUndefined(msgParsed?.pass))
                stuff_.pass = msgParsed.pass;

              ws.send(JSON.stringify(stuff_));
            }

            if (!msgParsed.type)
              return sendWC({ error: Error("type is undefined") });

            if (msgParsed.type !== "GoodMorning" && !wsData.hasGreeted)
              return sendWC({
                error: Error(
                  "U gotta say hello before I do anything for ya >:("
                ),
              });

            switch (msgParsed.type) {
              case "GoodMorning": {
                let token = msgParsed.token;
                if (!token)
                  return sendWC({ error: Error("Breh gimme that token") }, 499);

                let returned;
                await request("https://api.jubewe.de/users/me", {
                  headers: {
                    authorization: token,
                  },
                  json: true,
                })
                  .then((r) => {
                    if (r.body.status !== 200) throw Error(r.body.error);

                    if (!j.env.ALLOWED_USERIDS.includes(r.body.auth.userID))
                      return sendWC({ error: Error("No permission") }, 403);

                    sendWC({ message: "Zeas" });
                    wsData.hasGreeted = true;
                  })
                  .catch((e) => {
                    return sendWC({
                      error: Error(
                        "Could not get self of token",
                        { cause: e },
                        498
                      ),
                    });
                  });
                break;
              }

              case "getQuestions": {
                sendWC({ questions: convertToBuffer(questions) });
                break;
              }

              case "getResponse": {
                let responseNum = msgParsed.responseNum ?? 0;
                let response = csvLinesRaw[responseNum + 1];

                sendWC({
                  response: convertToBuffer(response),
                });
                break;
              }

              case "postRating": {
                let responseNum = msgParsed.responseNum ?? 0;
                let rating = msgParsed.rating;
                if (isNullUndefined(rating))
                  return sendWC({ error: Error("rating is undefined") });

                csvLinesRaw[responseNum + 1][ratingIndex] = rating;
                hasChanges = true;

                break;
              }
            }
          });
        });
      })();
    });
})();
