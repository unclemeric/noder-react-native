var React = require('react-native')
var window = require('../util/window')
var { width, height } = window.get()
var precomputeStyle = require('precomputeStyle')


var moment = require('moment')
var { Icon } = require('react-native-icons')
var KeyboardEvents = require('react-native-keyboardevents')
var KeyboardEventEmitter = KeyboardEvents.Emitter
var markdown = require("markdown").markdown

var Return = require('../components/overlay/Return')
var CommentHtml = require('../components/htmlRender/CommentHtml')
var CommentUp = require('../components/comment/CommentUp')
var Nav = require('../components/Nav')

var TopicService = require('../services/TopicService')
var genColor = require('../util/genColor')
var config = require('../configs/config')
var animations = require('../configs/animation')


var {
    View,
    StyleSheet,
    ScrollView,
    Component,
    Text,
    StatusBarIOS,
    Image,
    ListView,
    ActivityIndicatorIOS,
    TouchableOpacity,
    TouchableHighlight,
    Navigator,
    PushNotificationIOS,
    TextInput,
    LayoutAnimation
    } = React


class Comments extends Component {
    constructor(props) {
        super(props)
        var ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
        var data = [];
        this.state = {
            ds: ds.cloneWithRows(data),
            commentLoading: false,
            replyUploading: false,
            isLoaded: false,
            didFocus: false
        }
        this.updateKeyboardSpace = this.updateKeyboardSpace.bind(this)
        this.resetKeyboardSpace = this.resetKeyboardSpace.bind(this)
    }

    updateKeyboardSpace(frames) {
        LayoutAnimation.configureNext(animations.keyboard.layout.spring);
        this.commentsView.setNativeProps({
            height: commentsHeight - frames.end.height
        })
    }

    resetKeyboardSpace() {
        LayoutAnimation.configureNext(animations.keyboard.layout.spring);
        this.commentsView.setNativeProps({
            height: commentsHeight
        })
    }


    componentDidMount() {
        this._fetchComment()
        KeyboardEventEmitter.on(KeyboardEvents.KeyboardDidShowEvent, this.updateKeyboardSpace)
        KeyboardEventEmitter.on(KeyboardEvents.KeyboardWillHideEvent, this.resetKeyboardSpace)
    }


    componentDidFocus() {
        this.setState({
            didFocus: true
        })
    }


    componentWillUnmount() {
        KeyboardEventEmitter.off(KeyboardEvents.KeyboardDidShowEvent, this.updateKeyboardSpace)
        KeyboardEventEmitter.off(KeyboardEvents.KeyboardWillHideEvent, this.resetKeyboardSpace)
    }


    componentDidUpdate() {
        setTimeout(() => this._scrollToReply())
    }


    _scrollToReply() {
        let reply = this.props.reply
        if (reply) {
            let row = this[reply.id]
            if (row && row.measure) {
                row.measure((x, y, width, height, pageX, pageY) => {
                    this._listView.setNativeProps({
                        contentOffset: {
                            x: 0,
                            y: y
                        }
                    })
                })

                row.setNativeProps(precomputeStyle({
                    styles: {
                        backgroundColor: 'red'
                    }
                }))
            }
        }
    }


    _fetchComment() {
        if (this.state.commentLoading) {
            return
        }

        this.setState({
            commentLoading: true
        })
        TopicService.req.getTopicById(this.props.topic.id)
            .then(topic=> {
                this.topic = topic
                return topic.replies
            })
            .then(replies=> {
                return replies.reverse()
            })
            .then(comments=> {
                this.comments = comments
                this.setState({
                    ds: this.state.ds.cloneWithRows(this.comments),
                    commentLoading: false,
                    isLoaded: true
                })
            })
            .catch((err)=> {
                console.warn(err)
                this.setState({
                    commentLoading: false
                })
            })
            .done()
    }


    _doReply() {
        var content = this.textInputValue
        if (this.state.replyUploading || content == '' || content == null) {
            return
        }
        let user = this.props.state.user
        let topic = this.props.topic
        content = content + config.replySuffix

        this.setState({
            replyUploading: true
        })


        TopicService.req.reply(topic.id, content, user.token, this.replyId)
            .then(replyId=> {
                var newReply = {
                    id: replyId,
                    author: {
                        loginname: user.loginname,
                        avatar_url: user.avatar_url
                    },
                    content: markdown.toHTML(content),
                    ups: [],
                    create_at: new Date()
                }
                this.comments = [newReply].concat(this.comments)
                this.replyId = null
                this.setState({
                    ds: this.state.ds.cloneWithRows(this.comments),
                    replyUploading: false
                })
                this.textInput.setNativeProps({
                    text: ''
                })
                this.textInputValue = ''
                this.textInput.blur()
            })
            .catch(err=> {
                console.warn(err)
                this.setState({
                    replyUploading: false
                })
            })
            .done()
    }


    _onReplyPress(id, authorName) {
        this.textInput.focus()
        let text = `@${authorName} `
        this.textInput.setNativeProps({
            text: text
        })
        this.replyId = id
        this.textInputValue = text
    }


    _onAuthorTextPress(authorName) {
        let text = (this.textInputValue || '') + ` @${authorName} `

        this.textInput.setNativeProps({
            text: text
        })
        this.textInputValue = text
    }


    _onAuthorImgPress(authorName) {
        this.props.router.toUser({
            userName: authorName
        })
    }


    renderRow(comment, sectionID, rowID, highlightRow) {
        var authorName = comment.author.loginname
        var domain = config.domain
        var date = moment(comment.create_at).startOf('minute').fromNow()
        var commentNum = this.comments.length - parseInt(rowID)
        var focusStyle = {}
        if (this.props.reply) {
            let replyId = this.props.reply.id
            if (replyId == comment.id) {
                focusStyle = {
                    backgroundColor: 'rgba(0,2,125,0.07)'
                }
            }
        }

        var footer = (
            <View style={styles.commentFooter}>
                <CommentUp
                    replyId={comment.id}
                    authorName={authorName}
                    ups={comment.ups}
                    user={this.props.state.user}
                    style={styles.up}
                    ></CommentUp>

                <View style={styles.reply}>
                    <TouchableOpacity
                        onPress={this._onReplyPress.bind(this, comment.id, authorName)}>
                        <Icon
                            name={'ion|reply'}
                            size={20}
                            color='rgba(0,0,0,0.35)'
                            style={styles.replyIcon}
                            />
                    </TouchableOpacity>
                </View>
            </View>
        )


        return (
            <View
                ref={view=>this[comment.id]=view}
                key={comment.id}
                style={[styles.commentWrapper,focusStyle]}>
                <View style={[styles.imageWrapper]}>
                    <TouchableOpacity onPress={this._onAuthorImgPress.bind(this,authorName)}>
                        <Image
                            style={styles.authorImg}
                            source={{uri:domain + comment.author.avatar_url}}
                            >
                        </Image>
                    </TouchableOpacity>

                    <Text style={styles.commentNumText}>
                        {commentNum} 楼
                    </Text>
                </View>

                <View style={styles.commentContentWrapper}>
                    <View style={styles.commentHeader}>
                        <View style={styles.author}>
                            <TouchableOpacity onPress={this._onAuthorTextPress.bind(this,authorName)}>
                                <Text style={styles.authorText}>
                                    {{authorName}}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.date}>
                            <Text style={styles.dateText}>
                                {date}
                            </Text>
                        </View>
                    </View>

                    <CommentHtml
                        router={this.props.router}
                        style={commentHtmlStyle}
                        content={comment.content}/>

                    {!this.props.state.user || footer}
                </View>
            </View>
        )
    }


    _renderComments() {
        if (this.state.didFocus && this.state.isLoaded) {
            return (
                <ListView
                    ref={view=>this._listView=view}
                    style={{backgroundColor:'rgba(255,255,255,1)'}}
                    showsVerticalScrollIndicator={true}
                    initialListSize={10}
                    pagingEnabled={false}
                    removeClippedSubviews={true}
                    dataSource={this.state.ds}
                    renderRow={this.renderRow.bind(this)}
                    />
            )
        }

        return (
            <ActivityIndicatorIOS
                size="large"
                animating={true}
                style={{marginTop:20,width:width}}/>
        )
    }


    _renderReplySubmiteIcon() {
        if (this.state.replyUploading) {
            return (
                <View>
                    <ActivityIndicatorIOS
                        style={styles.submitIcon}
                        ></ActivityIndicatorIOS>
                </View>
            )
        }
        return (
            <Icon
                name={'ion|reply'}
                size={28}
                color='rgba(0,0,0,0.35)'
                style={styles.submitIcon}
                />
        )
    }


    _renderReplyForm() {
        var user = this.props.state.user

        if (!user) return null

        var userImg = config.domain + user.avatar_url

        return (
            <View style={styles.replyFormWrapper}>
                <View style={styles.replyUserImgWrapper}>
                    <TouchableOpacity onPress={()=>this.props.router.toUser({isLoginUser:true})}>
                        <Image
                            style={styles.userImg}
                            source={{uri: userImg}}/>
                    </TouchableOpacity>
                </View>

                <View style={styles.replyInputWrapper}>
                    <TextInput
                        ref={view=>this.textInput=view}
                        value={this.state.textInput}
                        multiline={true}
                        placeholder='嘿，说点啥吧'
                        style={styles.replyInput}
                        onChangeText={(text) => {
                            this.textInput.setNativeProps({
                                text:text
                            })
                            this.textInputValue = text
                        }}
                        />
                </View>

                <View style={styles.submit}>
                    <TouchableOpacity
                        onPress={() => this._doReply()}>
                        {this._renderReplySubmiteIcon()}
                    </TouchableOpacity>
                </View>
            </View>
        )
    }


    render() {
        var count = this.state.ds.getRowCount()

        var router = this.props.router

        var navs = {
            Left: {
                text: '返回',
                onPress: ()=> {
                    router.pop()
                }
            },
            Center: {
                text: '评论 ' + count,
                onPress: ()=> {
                    this._listView.setNativeProps({
                        contentOffset: {
                            x: 0,
                            y: 0
                        }
                    })
                }
            }
        }

        if (this.state.didFocus && this.props.reply && this.state.isLoaded) {
            navs = {
                ...navs,
                Right: {
                    text: '正文',
                    onPress: ()=> {
                        router.toTopic({
                            topic: this.topic
                        })
                    }
                }
            }
        }

        return (
            <View style={styles.container}>
                <Nav
                    navs={navs}
                    ></Nav>

                <View
                    ref={view=>this.commentsView=view}
                    style={[styles.comments,{height:this.props.state.user?commentsHeight:commentsHeight+replyFormHeight}]}>
                    {this._renderComments()}
                </View>

                {this._renderReplyForm()}
            </View>
        )
    }
}


var navHeight = 55
var authorImgSize = 35
var commentContentOffset = 15 * 2 + authorImgSize
var commentIconSize = 12
var replyFormHeight = 55
var commentsHeight = height - 40 - 20 - replyFormHeight
var submitButtonWidth = 55

var commentHtmlStyle = StyleSheet.create({
    img: {
        width: width - commentContentOffset - 15,
        height: width - commentContentOffset - 15,
        resizeMode: Image.resizeMode.contain
    }
})

var styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        height: height
    },

    titleText: {
        color: 'rgba(0,0,0,0.7)',
        fontSize: 16
    },

    comments: {
        //marginTop: 20,
        width: width,
        height: commentsHeight
    },

    commentWrapper: {
        borderBottomColor: 'rgba(0,0,0,0.02)',
        borderBottomWidth: 1,
        padding: 15,
        flexDirection: 'row',
    },

    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center'
    },

    date: {
        flexDirection: 'row',
        flex: 1
    },

    author: {
        flex: 1
    },
    authorText: {
        color: 'rgba(0,0,0,0.3)',
        fontSize: 12
    },

    dateIcon: {
        height: commentIconSize,
        width: commentIconSize,
        flexDirection: 'row'
    },

    dateText: {
        color: 'rgba(0,0,0,0.3)',
        fontSize: 12,
        textAlign: 'right',
        flex: 1
    },

    commentIcon: {
        height: commentIconSize,
        width: commentIconSize
    },


    imageWrapper: {
        width: authorImgSize + 15
    },

    commentNumText: {
        marginTop: 15,
        fontSize: 12,
        color: 'rgba(0,0,0,0.3)',
        textAlign: 'center',
        width: authorImgSize

    },

    commentContentWrapper: {
        width: width - commentContentOffset - 15,
    },

    authorImg: {
        height: authorImgSize,
        width: authorImgSize,
        borderRadius: authorImgSize / 2

    },
    commentFooter: {
        flexDirection: 'row',
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 15
    },
    up: {
        width: 80,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center'
    },
    replyIcon: {
        height: 12,
        width: 15
    },
    upIcon: {
        height: 10,
        width: 13
    },
    replyFormWrapper: {
        height: replyFormHeight + 4,
        width: width,
        flexDirection: 'row',
        shadowColor: 'rgba(0,0,0,1)',
        shadowOffset: {
            width: -2,
            height: -2
        },
        shadowOpacity: 0.1,
        alignItems: 'center'
    },
    replyUserImgWrapper: {
        width: authorImgSize + 15 * 2,
        flexDirection: 'row',
        justifyContent: 'center'
    },
    userImg: {
        height: authorImgSize,
        width: authorImgSize,
        resizeMode: Image.resizeMode.contain,
    },
    replyInputWrapper: {
        width: width - replyFormHeight - submitButtonWidth,
        flexDirection: 'row',
        alignItems: 'center'
    },
    replyInput: {
        flex: 1,
        fontSize: 14,
        height: 14 * 2,
        lineHeight: 14 * 1.4
    },
    submitIcon: {
        width: authorImgSize,
        height: authorImgSize
    }
})

module.exports = Comments
