declare global {
  interface Window {
    reportInputAccess?: (type: string, data: string, actionId?: string) => void;
    notifyFinishScan?: () => void;
    __currentActionId?: string;
    __actionIdStack?: string[];
  }
}
import { ResultAggregator } from "../results/resultAggregator";
import { Page } from "puppeteer";
import { Action } from "../types/scanTypes";

export class InputMonitor {
  constructor(private aggregator: ResultAggregator) {}

  public async setup(page: Page): Promise<void> {
    // Expose function to receive reports from the browser
    await page.exposeFunction(
      "reportInputAccess",
      (type: string, data: string, actionId?: string) => {
        // Use provided actionId or generate new one
        const finalActionId = actionId || `action_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const partId = "part_html_main";
        const action: Action = { actionId: finalActionId, type, data };
        this.aggregator.addAction(partId, action, "html");
      }
    );

    // Monitor direct input.value access
    await page.evaluateOnNewDocument(() => {
      // Initialize action stack if not present
      if (!window.__actionIdStack) {
        window.__actionIdStack = [];
      }
      
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      );
      if (!originalDescriptor) return;
      Object.defineProperty(HTMLInputElement.prototype, "value", {
        get: function () {
          let inputId = this.id
            ? `id=${this.id}`
            : this.name
            ? `name=${this.name}`
            : `element=${this.tagName.toLowerCase()}[${Array.from(
                document.querySelectorAll(this.tagName.toLowerCase())
              ).indexOf(this)}]`;
          
          // Generate actionId and set context that persists longer
          const actionId = `action_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          
          // Push current action to stack
          window.__actionIdStack!.push(actionId);
          window.__currentActionId = actionId;
          
          if (window.reportInputAccess) {
            window.reportInputAccess("input.value", inputId, actionId);
          }
          
          // Get the value
          const value = originalDescriptor.get?.call(this);
          
          // Schedule context cleanup to happen after any immediate async operations
          setTimeout(() => {
            if (window.__actionIdStack!.length > 0 && 
                window.__actionIdStack![window.__actionIdStack!.length - 1] === actionId) {
              window.__actionIdStack!.pop();
              window.__currentActionId = window.__actionIdStack!.length > 0 
                ? window.__actionIdStack![window.__actionIdStack!.length - 1] 
                : undefined;
            }
          }, 100); // Give time for any immediate fetch/xhr calls
          
          return value;
        },
        set: function (val) {
          if (originalDescriptor.set) {
            return originalDescriptor.set.call(this, val);
          }
        },
        configurable: true,
      });
      if (!window.reportInputAccess) {
        window.reportInputAccess = (type: string, data: string, actionId?: string) => {
          console.log(`Input access detected: ${type} - ${data} (actionId: ${actionId})`);
        };
      }
    });

    // Monitor addEventListener for input elements and forms
    await page.evaluateOnNewDocument(() => {
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) {
        const wrapHandler = (
          handler: any,
          actionType: string,
          elementId: string
        ) => {
          return function (this: any, ...args: any[]) {
            const actionId = `action_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            
            // Initialize stack if not present
            if (!window.__actionIdStack) {
              window.__actionIdStack = [];
            }
            
            // Push to stack and set current
            window.__actionIdStack.push(actionId);
            window.__currentActionId = actionId;
            
            if (window.reportInputAccess) {
              window.reportInputAccess(actionType, elementId, actionId);
            }
            
            // Handler runs with __currentActionId set
            const result = handler.apply(this, args);
            
            // Schedule context cleanup after potential async operations
            setTimeout(() => {
              if (window.__actionIdStack!.length > 0 && 
                  window.__actionIdStack![window.__actionIdStack!.length - 1] === actionId) {
                window.__actionIdStack!.pop();
                window.__currentActionId = window.__actionIdStack!.length > 0 
                  ? window.__actionIdStack![window.__actionIdStack!.length - 1] 
                  : undefined;
              }
            }, 100);
            
            return result;
          };
        };
        if (
          this instanceof HTMLInputElement ||
          this instanceof HTMLTextAreaElement ||
          this instanceof HTMLSelectElement
        ) {
          if (["change", "input", "keyup", "keydown"].includes(type)) {
            let elementId = this.id
              ? `id=${this.id}`
              : this.name
              ? `name=${this.name}`
              : `element=${this.tagName.toLowerCase()}[${Array.from(
                  document.querySelectorAll(this.tagName.toLowerCase())
                ).indexOf(this)}]`;
            if (typeof listener === "function") {
              listener = wrapHandler(
                listener,
                `input.addEventListener.${type}`,
                elementId
              );
            } else if (listener && typeof listener.handleEvent === "function") {
              const orig = listener.handleEvent;
              listener.handleEvent = wrapHandler(
                orig,
                `input.addEventListener.${type}`,
                elementId
              );
            }
          }
        } else if (this instanceof HTMLFormElement) {
          if (type === "submit") {
            let formId = this.id
              ? `id=${this.id}`
              : this.name
              ? `name=${this.name}`
              : `element=form[${Array.from(
                  document.querySelectorAll("form")
                ).indexOf(this)}]`;
            if (typeof listener === "function") {
              listener = wrapHandler(
                listener,
                "form.addEventListener.submit",
                formId
              );
            } else if (listener && typeof listener.handleEvent === "function") {
              const orig = listener.handleEvent;
              listener.handleEvent = wrapHandler(
                orig,
                "form.addEventListener.submit",
                formId
              );
            }
          }
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    // Expose window.finishScan to call window.notifyFinishScan
    await page.evaluateOnNewDocument(() => {
      window.finishScan = () => {
        if (window.notifyFinishScan) {
          window.notifyFinishScan();
        }
      };
    });
  }
}
