// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <=0.8.19;

contract FileStorage {

    struct File {
        string name;
        string hash;
    }

    File [] files; 

    function set(string memory _fileHash, string memory _fileName) public
    {
        File memory newFile = File(_fileName, _fileHash);
        files.push(newFile);
    }

    function get() public view returns(File [] memory)
    {
        return files;
    }
}