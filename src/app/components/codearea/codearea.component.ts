import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';


@Component({
  selector: 'app-codearea',
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorModule
  ],
  templateUrl: './codearea.component.html',
})
export class CodeareaComponent {

  editorOptions = {
    theme: 'vs-dark',
    language: 'text',
    automaticLayout: true,
    suggestOnTriggerCharacters: false,
    quickSuggestions: false,
    parameterHints: { enabled: false },
    wordBasedSuggestions: false,
    suggest: {
      snippetsPreventQuickSuggestions: false
    },
    hover: { enabled: false }
  };

  code: string = 'function x() {\nconsole.log("Hello world!");\n}';

  output() {
    // console.log(this.code);
  }
}
