## eval-deobfuscator
A deobfuscator based on ```eval```ing deobfuscation functions.   This is done through NodeJS [VMs](https://nodejs.org/api/vm.html).

### Run

    npm install
    node src/index.js

### Features
The deobfuscators do not work by looking for hardcoded function names so they should continue to work regardless of updates (unless the obfuscation schemes change significantly).  
Currently supported and tested scripts (more may work if they use any of the obfuscation techniques listed below this list):

    * Akami
    * ArkoseLabs
    * Datadome
    * Distil
    * Geocomply
    * Shape Security / F5 (basic implementation, non virtual machine based)
    * PerimeterX

Multiple different generic obfuscators supported:
    
    * Array literal subsitution
    * Obfuscator.io base64
    * Obfuscator.io array literal subsitution with function
    * JScrambler (strings)

### Other

Will do major refactoring once more scripts are added and I identify more commonalities / abstractions.