// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <=0.8.19;

contract Files {
    string [] fileHashes;
    function set(string memory _fileHash) public
    {
        fileHashes.push(_fileHash);
    }

    function get() public view returns(string [] memory)
    {
        return fileHashes;
    }
}