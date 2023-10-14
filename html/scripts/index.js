const { oberknechtEmitter } = require("oberknecht-emitters");
const {
  convertToArray,
  getKeyFromObject,
  addKeysToObject,
  deleteKeyFromObject,
} = require("oberknecht-utils");

let url = new URL(document.baseURI);
const Buffer = require("buffer").Buffer;

const isLocal = /^((127(\.0){2}\.1))/.test(url.hostname);
const ws = new WebSocket(
  isLocal
    ? `ws://` + url.hostname + ":3001"
    : `wss://${url.hostname.split(".")[0]}-ws.${url.hostname
        .split(".")
        .slice(1)
        .join(".")}`
);
const emitter = new oberknechtEmitter();

let questions = [];

class functions {
  static appendElementOptions = (element, options) => {
    if (!element || !options) return;
    Object.keys(options).forEach((optionName) => {
      switch (optionName) {
        case "classes": {
          convertToArray(options[optionName]).forEach((a) =>
            element.classList.add(a)
          );
          break;
        }

        case "childNodes": {
          convertToArray(options[optionName]).forEach((a) => {
            element.appendChild(a);
          });
          break;
        }

        case "style": {
          Object.keys(options[optionName]).forEach((a) => {
            element.style[a] = options[optionName][a];
          });
          break;
        }

        default: {
          element[optionName] = options[optionName];
        }
      }
    });
  };

  static localStorage = class {
    static #key = "j";

    static init = () => {
      let newStorage = { cache: {} };
      this.setStorage(newStorage);
    };

    static initIfNonexistent = () => {
      if (!(this.getStorage() ?? undefined)) this.init();
    };

    static getStorage = () => {
      let item = localStorage.getItem(this.#key);
      if (!(item ?? undefined)) return null;
      return JSON.parse(localStorage.getItem(this.#key));
    };

    static setStorage = (newStorage) => {
      localStorage.setItem(this.#key, JSON.stringify(newStorage));
    };

    static getKey = (keypath) => {
      let storage = this.getStorage();
      return getKeyFromObject(storage, keypath);
    };

    static setKey = (keypath, value) => {
      let storage = this.getStorage();
      let newstorage = addKeysToObject(storage, keypath, value);
      this.setStorage(newstorage);
    };

    static deleteKey = (keypath) => {
      let storage = this.getStorage();
      if (!this.getKey(keypath)) return;
      let newstorage = deleteKeyFromObject(storage, keypath);
      this.setStorage(newstorage);
    };

    static emptyCache = () => {
      functions.localStorage.setKey("cache", {});
    };
  };
}

functions.localStorage.initIfNonexistent();

let responseNum = functions.localStorage.getKey("responseNum") ?? 0;
if (url.searchParams.get("token")) {
  functions.localStorage.setKey("token", url.searchParams.get("token"));
  window.history.pushState({}, "", url.origin);
}

let apiToken = functions.localStorage.getKey("token");
function openLogin() {
  window.open(
    `https://jubewe.de/oauth/token?redirect=${url.origin}?login=`,
    "_self"
  );
}
if (!apiToken) openLogin();
let response;
class elements {
  /** @returns {HTMLElement} */
  static createElement = (elementName, options) => {
    let r = document.createElement(elementName);

    functions.appendElementOptions(r, options);

    return r;
  };

  static loadjBody = () => {
    let jBody = elements.createElement("jbody");
    document.querySelector("body").appendChild(jBody);
  };

  static loadResponse = (number) => {
    responseNum = number ?? responseNum;
    functions.localStorage.setKey("responseNum", responseNum);

    sendWC({
      type: "getResponse",
      responseNum: responseNum,
    }).then((r) => {
      if (!r.response) return;

      response = r.response.map((a) =>
        Buffer.from(a, "base64").toString("utf-8")
      );
      elements.appendResponse(response);
    });
  };

  static appendResponse = (response) => {
    if (document.querySelector("jbody #responseContainer"))
      document.querySelector("jbody #responseContainer").remove();

    let responseContainer = elements.createElement("div", {
      id: "responseContainer",
    });
    let qaContainer = elements.createElement("div", {
      classes: ["qaContainerOutter"],
    });

    (() => {
      questions.forEach((question, i) => {
        let qa = elements.createElement("div", {
          classes: ["qaContainer"],
        });

        let questionH = elements.createElement("jh", {
          classes: ["questionH"],
          innerText: question,
        });

        let answerH = elements.createElement("jh", {
          classes: ["answerH"],
          innerText: response[i],
        });

        [questionH, answerH].forEach((a) => qa.appendChild(a));

        qaContainer.appendChild(qa);
      });
    })();

    let bottomContainer = elements.createElement("div", {
      classes: ["bottomContainer"],
    });

    let ratingContainer = elements.createElement("div", {
      classes: ["ratingContainer"],
    });

    (() => {
      for (let i = 0; i <= 10; i++) {
        let ratingElem = elements.createElement("jh", {
          innerText: i.toString(),
          classes: [
            "ratingNumber",
            ...(i < 3 ? ["bg-red"] : []),
            ...(i < 7 && i > 2 ? ["bg-orange"] : []),
            ...(i < 9 && i > 6 ? ["bg-yellow"] : []),
            ...(i > 8 ? ["bg-green-light"] : []),
            "fg-black",
          ],
        });

        ratingElem.onclick = () => {
          sendWC({
            type: "postRating",
            rating: i,
            responseNum: responseNum,
          });
        };

        ratingContainer.appendChild(ratingElem);
      }
    })();

    let pageControlContainer = elements.createElement("div", {
      classes: ["pageControlContainer"],
    });

    (() => {
      let previousButton = elements.createElement("button", {
        innerText: "Previous",
      });

      let responseNumH = elements.createElement("jh", {
        innerText: responseNum,
      });

      let nextButton = elements.createElement("button", {
        innerText: "Next",
      });

      previousButton.onclick = () => {
        if (responseNum > 0) {
          responseNum--;
          elements.loadResponse();
        }
      };

      nextButton.onclick = () => {
        responseNum++;
        elements.loadResponse();
      };

      [previousButton, responseNumH, nextButton].forEach((a) =>
        pageControlContainer.appendChild(a)
      );
    })();

    [ratingContainer, pageControlContainer].forEach((a) =>
      bottomContainer.appendChild(a)
    );

    [qaContainer, bottomContainer].forEach((a) =>
      responseContainer.appendChild(a)
    );
    document.querySelector("jbody").appendChild(responseContainer);
  };
}

async function sendWC(stuff, status) {
  return new Promise((resolve) => {
    let stuff_ = {};

    if (typeof stuff !== "object") stuff_.data = stuff;
    else stuff_ = { ...stuff };
    stuff_.status = status ?? 200;
    if (stuff instanceof Error || stuff.error)
      stuff_.error = returnErr(stuff?.error ?? stuff);
    const id = wsMsgID++;
    stuff_.pass = id;

    ws.send(JSON.stringify(stuff_));
    emitter.once(`ws:message:${id}`, (a) => {
      if ([498, 499].includes(a.status)) return openLogin();
      if (a.status !== 200 || a.error) {
        let errorElem = elements.createElement("h", {
          innerText: a.error,
        });

        document.querySelector("jbody").appendChild(errorElem);
        document
          .querySelector("jbody")
          .appendChild(elements.createElement("br"));
      }

      resolve(a);
    });
  });
}
let wsMsgID = 0;
document.addEventListener("DOMContentLoaded", () => {
  elements.loadjBody();

  let questionsPromise;

  ws.onopen = () => {
    console.log("ws opened");
    sendWC({ type: "GoodMorning", token: apiToken }).then((a) => {
      sendWC({ type: "getQuestions" }).then((b) => {
        questions = b.questions.map((c) =>
          Buffer.from(c, "base64").toString("utf-8")
        );
        elements.loadResponse();
      });
    });
  };

  ws.onmessage = (m) => {
    let msgParsed = JSON.parse(m.data);
    emitter.emit(["ws:message", `ws:message:${msgParsed.pass}`], msgParsed);
  };

  (async () => {
    await questionsPromise;
  })();
});
