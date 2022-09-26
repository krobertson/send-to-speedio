# Send to Speedio

A quick and easy way to transfer the current file to your Brother Speedio
machine directly from VSCode.

This extension makes use of the NC Type 2 protocol to communicate with your
machine on port 10000 (by default). This is the same as used by BrotherComm.

## Configuration

After installing, open your VSCode settings, go down to Extensions, Send to Speedio, and be sure to set the IP Address for your machine, the port (if using something other than 10000), and whether the controller is A00/B00/C00.

## Usage

While you have an NC file open, simply open the VS commands (Command-Shift-P or
Control-Shift-P) and go to Send to Speedio.

The command will perform some baseline validations to ensure you have a `.nc` file open, and that it is in the format expected by the machine, namely `O1234.nc`.
