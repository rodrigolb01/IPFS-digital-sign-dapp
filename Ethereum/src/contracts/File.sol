// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <=0.8.19;


contract File {
    string fileHash;
    function set(string memory _fileHash) public
    {
        fileHash = _fileHash;
    }

    function get() public view returns(string memory)
    {
        return fileHash;
    }
}